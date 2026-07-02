import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { FillInScreenshotAttach } from '@/components/student/FillInScreenshotAttach';
import { Spinner } from '@/components/ui/spinner';
import {
  buildFillInQuestionPointsMap,
  displayFillAnswer,
  formatFillQuestionPoints,
  parseFillInTitleQuestionNo,
  resolveFillQuestionLeaderId,
} from '@/lib/fillin';
import { examQuestionAnchorId } from '@/lib/exam-question-nav';
import { ApiError, studentApi } from '@/lib/student';
import type {
  ExamPaperItem,
  ExamSubmissionItem,
  FillInScreenshotInfo,
} from '@/lib/student';
import { cn } from '@/lib/utils';

type FillRow = ExamPaperItem | ExamSubmissionItem;

type StudentFillInWordViewerProps = {
  examId: string;
  items: FillRow[];
  answers: Record<string, string>;
  readOnly: boolean;
  onAnswerChange: (examQuestionId: string, value: string) => void;
  screenshotsByQuestion: Record<string, FillInScreenshotInfo[]>;
  onScreenshotsChange: (
    examQuestionId: string,
    screenshots: FillInScreenshotInfo[],
  ) => void;
};

type PreviewCacheEntry = {
  html: string;
  version: string;
};

type ParsedPreviewNode =
  | string
  | {
      kind: 'element';
      tag: string;
      attrs: Record<string, string>;
      children: ParsedPreviewNode[];
    }
  | {
      kind: 'input';
      attrs: Record<string, string>;
    };

/** 同场考试切 tab 不重复请求；配合 HTTP ETag / 图片 immutable 缓存。 */
const previewByExam = new Map<string, PreviewCacheEntry>();

function fillRowKey(row: FillRow): string | null {
  if (!row.fillQuestionNo || !row.fillBlankIndex) return null;
  return `${row.fillQuestionNo}::${row.fillBlankIndex}`;
}

function parsePreviewNode(node: ChildNode): ParsedPreviewNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style') {
    return null;
  }

  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) continue;
    attrs[name] = attr.value;
  }

  if (tag === 'input' && el.classList.contains('fillin-inline-input')) {
    return { kind: 'input', attrs };
  }

  return {
    kind: 'element',
    tag,
    attrs,
    children: Array.from(el.childNodes)
      .map(parsePreviewNode)
      .filter((child): child is ParsedPreviewNode => child !== null),
  };
}

function parseInlinePreviewHtml(html: string): ParsedPreviewNode[] | null {
  if (!html.includes('fillin-inline-input')) return null;
  const doc = new DOMParser().parseFromString(
    `<div data-root="true">${html}</div>`,
    'text/html',
  );
  const root = doc.body.querySelector('[data-root="true"]');
  if (!root) return null;
  return Array.from(root.childNodes)
    .map(parsePreviewNode)
    .filter((node): node is ParsedPreviewNode => node !== null);
}

function reactPropsFromAttrs(
  attrs: Record<string, string>,
): Record<string, string | number | boolean> {
  const props: Record<string, string | number | boolean> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class') {
      props.className = value;
      continue;
    }
    if (name === 'style') continue;
    if (name === 'colspan' || name === 'rowspan') {
      props[name === 'colspan' ? 'colSpan' : 'rowSpan'] = Number(value);
      continue;
    }
    if (name === 'autocomplete') {
      props.autoComplete = value;
      continue;
    }
    if (name === 'tabindex') {
      props.tabIndex = Number(value);
      continue;
    }
    props[name] = value;
  }
  return props;
}

function extractTitleQuestionNo(node: ParsedPreviewNode): string | null {
  if (typeof node === 'string' || node.kind === 'input') return null;
  if (
    node.tag === 'p' &&
    (node.attrs.class ?? '').includes('fillin-inline-title')
  ) {
    const text = node.children
      .filter((child): child is string => typeof child === 'string')
      .join('')
      .trim();
    return parseFillInTitleQuestionNo(text);
  }
  for (const child of node.children) {
    const qNo = extractTitleQuestionNo(child);
    if (qNo) return qNo;
  }
  return null;
}

export function StudentFillInWordViewer({
  examId,
  items,
  answers,
  readOnly,
  onAnswerChange,
  screenshotsByQuestion,
  onScreenshotsChange,
}: StudentFillInWordViewerProps) {
  const cached = previewByExam.get(examId);
  const [html, setHtml] = useState<string | null>(cached?.html ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const parsedInlinePreviewRef = useRef<ParsedPreviewNode[] | null>(null);
  const parsedInlinePreviewHtmlRef = useRef<string | null>(null);
  const htmlFallbackRef = useRef<HTMLDivElement>(null);

  const fillRows = useMemo(
    () =>
      [...items]
        .filter((i) => i.type === 'FILL')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  const fillRowsByKey = useMemo(() => {
    const map = new Map<string, FillRow>();
    for (const row of fillRows) {
      const key = fillRowKey(row);
      if (key) map.set(key, row);
    }
    return map;
  }, [fillRows]);

  const pointsByQuestionNo = useMemo(
    () => buildFillInQuestionPointsMap(fillRows),
    [fillRows],
  );

  const multiBlankByQuestion = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of fillRows) {
      const key = row.fillQuestionNo ?? row.examQuestionId;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [fillRows]);

  const inlinePreviewNodes = useMemo(() => {
    if (!html) {
      parsedInlinePreviewHtmlRef.current = null;
      parsedInlinePreviewRef.current = null;
      return null;
    }
    if (parsedInlinePreviewHtmlRef.current === html) {
      return parsedInlinePreviewRef.current;
    }
    const parsed = parseInlinePreviewHtml(html);
    parsedInlinePreviewHtmlRef.current = html;
    parsedInlinePreviewRef.current = parsed;
    return parsed;
  }, [html]);

  useEffect(() => {
    const entry = previewByExam.get(examId);
    if (entry) {
      setHtml(entry.html);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await studentApi.fetchFillInWordPreview(examId);
        if (cancelled) return;
        if ('notModified' in data && data.notModified) {
          const again = previewByExam.get(examId);
          if (again) {
            setHtml(again.html);
          }
          return;
        }
        previewByExam.set(examId, {
          html: data.html,
          version: data.version,
        });
        setHtml(data.html);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : '无法加载试卷预览',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  useEffect(() => {
    if (!html || inlinePreviewNodes || !htmlFallbackRef.current) return;

    const root = htmlFallbackRef.current;

    for (const title of root.querySelectorAll('.fillin-inline-title')) {
      const qNo = parseFillInTitleQuestionNo(title.textContent ?? '');
      if (!qNo) continue;
      const points = pointsByQuestionNo.get(qNo);
      if (points == null) continue;
      if (title.querySelector('.fillin-inline-points')) continue;
      const span = document.createElement('span');
      span.className = 'fillin-inline-points';
      span.textContent = ` · ${formatFillQuestionPoints(points)} 分`;
      title.appendChild(span);
    }

    const inputs = root.querySelectorAll('input.fillin-inline-input');
    let fallbackIndex = 0;
    for (const input of inputs) {
      const el = input as HTMLInputElement;
      const questionNo = el.getAttribute('data-fillin-question-no');
      const blankIndex = el.getAttribute('data-fillin-blank-index');
      const order = Number(el.getAttribute('data-fillin-order') ?? fallbackIndex);
      const row =
        questionNo && blankIndex
          ? fillRowsByKey.get(`${questionNo}::${blankIndex}`) ??
            fillRows[order]
          : fillRows[order];
      fallbackIndex += 1;
      if (row) {
        el.id = examQuestionAnchorId(row.examQuestionId);
        el.classList.add('scroll-mt-4');
        const groupKey = row.fillQuestionNo ?? row.examQuestionId;
        if ((multiBlankByQuestion.get(groupKey) ?? 0) > 1) {
          el.setAttribute(
            'aria-label',
            `第 ${questionNo ?? '—'} 题第 ${blankIndex ?? '—'} 空（${formatFillQuestionPoints(row.points)} 分）`,
          );
        }
      }
    }
  }, [
    html,
    inlinePreviewNodes,
    fillRows,
    fillRowsByKey,
    pointsByQuestionNo,
    multiBlankByQuestion,
  ]);

  function resolveInlineInputRow(
    attrs: Record<string, string>,
    fallbackIndex: number,
  ): FillRow | undefined {
    const questionNo = attrs['data-fillin-question-no'];
    const blankIndex = attrs['data-fillin-blank-index'];
    const order = Number(attrs['data-fillin-order'] ?? fallbackIndex);
    return questionNo && blankIndex
      ? fillRowsByKey.get(`${questionNo}::${blankIndex}`) ?? fillRows[order]
      : fillRows[order];
  }

  function renderPreviewNode(
    node: ParsedPreviewNode,
    key: string,
    inputIndex: { current: number },
  ): ReactNode {
    if (typeof node === 'string') return node;

    if (node.kind === 'input') {
      const index = inputIndex.current;
      inputIndex.current += 1;
      const row = resolveInlineInputRow(node.attrs, index);
      const props = reactPropsFromAttrs(node.attrs);
      if (!row) {
        return createElement('input', {
          ...props,
          key,
          disabled: true,
          readOnly: true,
        });
      }

      const groupKey = row.fillQuestionNo ?? row.examQuestionId;
      const showBlankPoints = (multiBlankByQuestion.get(groupKey) ?? 0) > 1;
      const questionNo = node.attrs['data-fillin-question-no'];
      const blankIndex = node.attrs['data-fillin-blank-index'];
      const ariaLabel =
        showBlankPoints && questionNo && blankIndex
          ? `第 ${questionNo} 题第 ${blankIndex} 空（${formatFillQuestionPoints(row.points)} 分）`
          : props['aria-label'];

      const inputEl = createElement('input', {
        ...props,
        key: `${row.examQuestionId}-input`,
        id: examQuestionAnchorId(row.examQuestionId),
        className: cn(
          typeof props.className === 'string' ? props.className : undefined,
          'scroll-mt-4',
        ),
        'aria-label': ariaLabel,
        value: displayFillAnswer(answers[row.examQuestionId] ?? ''),
        disabled: readOnly,
        readOnly,
        onChange: (event) =>
          onAnswerChange(row.examQuestionId, event.currentTarget.value),
      });

      if (!showBlankPoints) {
        return inputEl;
      }

      return createElement(
        'span',
        { key: row.examQuestionId, className: 'inline' },
        createElement(
          'span',
          { className: 'fillin-inline-blank-points', key: 'pts' },
          `${formatFillQuestionPoints(row.points)}分 `,
        ),
        inputEl,
      );
    }

    if (
      node.kind === 'element' &&
      node.tag === 'p' &&
      (node.attrs.class ?? '').includes('fillin-inline-title')
    ) {
      const titleText = node.children
        .filter((child): child is string => typeof child === 'string')
        .join('')
        .trim();
      const qNo = parseFillInTitleQuestionNo(titleText);
      const totalPoints = qNo ? pointsByQuestionNo.get(qNo) : undefined;
      const hasPointsSpan = node.children.some(
        (child) =>
          typeof child !== 'string' &&
          child.kind === 'element' &&
          child.tag === 'span' &&
          (child.attrs.class ?? '').includes('fillin-inline-points'),
      );
      const props = reactPropsFromAttrs(node.attrs);
      const children = node.children
        .filter(
          (child) =>
            !(
              typeof child !== 'string' &&
              child.kind === 'element' &&
              child.tag === 'span' &&
              (child.attrs.class ?? '').includes('fillin-inline-points')
            ),
        )
        .map((child, index) =>
          renderPreviewNode(child, `${key}-${index}`, inputIndex),
        );
      return createElement(
        'p',
        { ...props, key },
        ...children,
        totalPoints != null && !hasPointsSpan
          ? createElement(
              'span',
              { key: 'pts', className: 'fillin-inline-points' },
              ` · ${formatFillQuestionPoints(totalPoints)} 分`,
            )
          : null,
      );
    }

    if (
      node.kind === 'element' &&
      node.tag === 'section' &&
      (node.attrs.class ?? '').includes('fillin-inline-question')
    ) {
      const qNo = extractTitleQuestionNo(node);
      const leaderId = qNo ? resolveFillQuestionLeaderId(fillRows, qNo) : null;
      const props = reactPropsFromAttrs(node.attrs);
      const children = node.children.map((child, index) =>
        renderPreviewNode(child, `${key}-${index}`, inputIndex),
      );
      if (leaderId) {
        children.push(
          createElement(
            'div',
            {
              key: `screenshots-${leaderId}`,
              className: 'fillin-inline-screenshots',
            },
            createElement(FillInScreenshotAttach, {
              examId,
              examQuestionId: leaderId,
              screenshots: screenshotsByQuestion[leaderId] ?? [],
              readOnly,
              onScreenshotsChange,
              variant: 'inline-card',
            }),
          ),
        );
      }
      return createElement('section', { ...props, key }, ...children);
    }

    const props = reactPropsFromAttrs(node.attrs);
    const children = node.children.map((child, index) =>
      renderPreviewNode(child, `${key}-${index}`, inputIndex),
    );
    return createElement(node.tag, { ...props, key }, ...children);
  }

  function renderInlinePreview(): ReactNode {
    if (!inlinePreviewNodes) return null;
    const inputIndex = { current: 0 };
    return inlinePreviewNodes.map((node, index) =>
      renderPreviewNode(node, String(index), inputIndex),
    );
  }

  return (
    <div>
      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {!loading && !error && inlinePreviewNodes ? (
          <div className="fillin-word-preview max-w-none text-2xl leading-relaxed text-foreground">
            {renderInlinePreview()}
          </div>
        ) : null}
        {!loading && !error && html && !inlinePreviewNodes ? (
          <div
            ref={htmlFallbackRef}
            className="fillin-word-preview max-w-none text-2xl leading-relaxed text-foreground [&_img]:max-w-full [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      </div>
    </div>
  );
}

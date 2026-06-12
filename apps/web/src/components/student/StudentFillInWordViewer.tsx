import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Spinner } from '@/components/ui/spinner';
import { displayFillAnswer } from '@/lib/fillin';
import { ApiError, studentApi } from '@/lib/student';
import type { ExamPaperItem, ExamSubmissionItem } from '@/lib/student';

type FillRow = ExamPaperItem | ExamSubmissionItem;

type StudentFillInWordViewerProps = {
  examId: string;
  items: FillRow[];
  answers: Record<string, string>;
  readOnly: boolean;
  onAnswerChange: (examQuestionId: string, value: string) => void;
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

export function StudentFillInWordViewer({
  examId,
  items,
  answers,
  readOnly,
  onAnswerChange,
}: StudentFillInWordViewerProps) {
  const cached = previewByExam.get(examId);
  const [html, setHtml] = useState<string | null>(cached?.html ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const parsedInlinePreviewRef = useRef<ParsedPreviewNode[] | null>(null);
  const parsedInlinePreviewHtmlRef = useRef<string | null>(null);

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
      return createElement('input', {
        ...props,
        key: row.examQuestionId,
        value: displayFillAnswer(answers[row.examQuestionId] ?? ''),
        disabled: readOnly,
        readOnly,
        onChange: (event) =>
          onAnswerChange(row.examQuestionId, event.currentTarget.value),
      });
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5 sm:p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {!loading && !error && inlinePreviewNodes ? (
          <div className="fillin-word-preview max-w-none text-base leading-relaxed text-foreground">
            {renderInlinePreview()}
          </div>
        ) : null}
        {!loading && !error && html && !inlinePreviewNodes ? (
          <div
            className="fillin-word-preview max-w-none text-base leading-relaxed text-foreground [&_img]:max-w-full [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      </div>
    </div>
  );
}

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';

import { FillInScreenshotAttach } from '@/components/student/FillInScreenshotAttach';
import { Spinner } from '@/components/ui/spinner';
import { displayFillAnswer, resolveFillQuestionLeaderId } from '@/lib/fillin';
import { splitPreviewHtmlByQuestionRaw } from '@/lib/fillin-preview-split';
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

/** 同场考试切 tab 不重复请求；配合 HTTP ETag / 图片 immutable 缓存。 */
const previewByExam = new Map<string, PreviewCacheEntry>();

function fillRowKey(row: FillRow): string | null {
  if (!row.fillQuestionNo || !row.fillBlankIndex) return null;
  return `${row.fillQuestionNo}::${row.fillBlankIndex}`;
}

function resolveInputRow(
  el: HTMLInputElement,
  fillRowsByKey: Map<string, FillRow>,
  fillRows: FillRow[],
  fallbackIndex: number,
): FillRow | undefined {
  const questionNo = el.getAttribute('data-fillin-question-no');
  const blankIndex = el.getAttribute('data-fillin-blank-index');
  const order = Number(el.getAttribute('data-fillin-order') ?? fallbackIndex);
  return questionNo && blankIndex
    ? fillRowsByKey.get(`${questionNo}::${blankIndex}`) ?? fillRows[order]
    : fillRows[order];
}

/** 仅随 html 变化重渲染，避免作答 state 更新时 React 重置 innerHTML 导致失焦。 */
const FillInQuestionBody = memo(function FillInQuestionBody({
  html,
}: {
  html: string;
}) {
  return (
    <div
      className="fillin-question-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

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
  const previewRootRef = useRef<HTMLDivElement>(null);
  const onAnswerChangeRef = useRef(onAnswerChange);
  const answersRef = useRef(answers);

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

  const fillRowsRef = useRef(fillRows);
  const fillRowsByKeyRef = useRef(fillRowsByKey);
  onAnswerChangeRef.current = onAnswerChange;
  answersRef.current = answers;
  fillRowsRef.current = fillRows;
  fillRowsByKeyRef.current = fillRowsByKey;

  const htmlSegments = useMemo(() => {
    if (!html) return null;
    return splitPreviewHtmlByQuestionRaw(html);
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
        const data = await studentApi.fetchFillInWordPreview(
          examId,
          previewByExam.get(examId)?.version,
        );
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
    const root = previewRootRef.current;
    if (!root || !htmlSegments) return;

    let fallbackIndex = 0;
    for (const input of root.querySelectorAll('input.fillin-inline-input')) {
      const el = input as HTMLInputElement;
      const row = resolveInputRow(
        el,
        fillRowsByKeyRef.current,
        fillRowsRef.current,
        fallbackIndex,
      );
      fallbackIndex += 1;

      if (row) {
        el.id = examQuestionAnchorId(row.examQuestionId);
        el.classList.add('scroll-mt-4');
        el.value = displayFillAnswer(
          answersRef.current[row.examQuestionId] ?? '',
        );
      }

      el.disabled = readOnly;
      el.readOnly = readOnly;
    }

    if (readOnly) return;

    const onInput = (event: Event) => {
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) ||
        !target.classList.contains('fillin-inline-input')
      ) {
        return;
      }
      const row = resolveInputRow(
        target,
        fillRowsByKeyRef.current,
        fillRowsRef.current,
        Number(target.getAttribute('data-fillin-order') ?? 0),
      );
      if (row) {
        onAnswerChangeRef.current(row.examQuestionId, target.value);
      }
    };

    root.addEventListener('input', onInput);
    return () => root.removeEventListener('input', onInput);
  }, [htmlSegments, readOnly]);

  useEffect(() => {
    const root = previewRootRef.current;
    if (!root) return;

    let fallbackIndex = 0;
    for (const input of root.querySelectorAll('input.fillin-inline-input')) {
      const el = input as HTMLInputElement;
      const row = resolveInputRow(
        el,
        fillRowsByKeyRef.current,
        fillRowsRef.current,
        fallbackIndex,
      );
      fallbackIndex += 1;

      el.disabled = readOnly;
      el.readOnly = readOnly;
      if (!row || el === document.activeElement) continue;

      const nextValue = displayFillAnswer(answers[row.examQuestionId] ?? '');
      if (el.value !== nextValue) {
        el.value = nextValue;
      }
    }
  }, [answers, readOnly]);

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
        {!loading && !error && htmlSegments ? (
          <div
            ref={previewRootRef}
            className="fillin-word-preview fillin-split-layout max-w-none text-xl leading-relaxed text-foreground [&_img]:max-w-full [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          >
            {htmlSegments.map((segment, segIdx) => {
              const leaderId = segment.questionNo
                ? resolveFillQuestionLeaderId(fillRows, segment.questionNo)
                : null;
              const isEmbeddedImage =
                !segment.questionNo && /<img[\s>]/i.test(segment.html);

              return (
                <section
                  key={`seg-${segIdx}-${segment.questionNo ?? 'pre'}`}
                  className={cn(
                    'fillin-question-block',
                    !leaderId && 'fillin-question-block--no-shots',
                    isEmbeddedImage && 'fillin-question-block--embedded-image',
                  )}
                >
                  {segment.html ? (
                    <div className="fillin-question-main">
                      <FillInQuestionBody html={segment.html} />
                    </div>
                  ) : null}
                  {leaderId ? (
                    <aside
                      className="fillin-question-screenshots"
                      aria-label={`第 ${segment.questionNo} 题截图`}
                    >
                      <p className="mb-1 flex items-center gap-1 text-sm font-semibold text-foreground">
                        <ImagePlus className="size-3.5 shrink-0 text-amber-700" aria-hidden />
                        第 {segment.questionNo} 题截图
                      </p>
                      <p className="mb-2 text-xs text-muted-foreground">
                        佐证，不计分
                      </p>
                      <FillInScreenshotAttach
                        examId={examId}
                        examQuestionId={leaderId}
                        screenshots={screenshotsByQuestion[leaderId] ?? []}
                        readOnly={readOnly}
                        onScreenshotsChange={onScreenshotsChange}
                        variant="sidebar"
                      />
                    </aside>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

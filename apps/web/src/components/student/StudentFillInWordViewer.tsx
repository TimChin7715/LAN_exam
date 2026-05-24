import { useEffect, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { ApiError, studentApi } from '@/lib/student';

type StudentFillInWordViewerProps = {
  examId: string;
};

type PreviewCacheEntry = {
  html: string;
  version: string;
};

/** 同场考试切 tab 不重复请求；配合 HTTP ETag / 图片 immutable 缓存。 */
const previewByExam = new Map<string, PreviewCacheEntry>();

export function StudentFillInWordViewer({ examId }: StudentFillInWordViewerProps) {
  const cached = previewByExam.get(examId);
  const [html, setHtml] = useState<string | null>(cached?.html ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <p className="text-sm font-medium text-foreground">试卷预览</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {!loading && !error && html ? (
          <div
            className="fillin-word-preview max-w-none text-sm leading-relaxed text-foreground [&_img]:max-w-full [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      </div>
    </div>
  );
}

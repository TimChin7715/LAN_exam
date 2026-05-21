import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, studentApi } from '@/lib/student';

type StudentFillInWordViewerProps = {
  examId: string;
  wordFileName?: string;
};

export function StudentFillInWordViewer({
  examId,
  wordFileName,
}: StudentFillInWordViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await studentApi.fetchFillInWordPreview(examId);
        if (!cancelled) setHtml(data.html);
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

  async function handleDownload() {
    if (!wordFileName) return;
    setDownloading(true);
    try {
      await studentApi.downloadFillInWord(examId, wordFileName);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下载试卷失败');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-medium text-foreground">试卷</p>
        {wordFileName ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Spinner className="size-4" />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            下载 Word
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain p-4">
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

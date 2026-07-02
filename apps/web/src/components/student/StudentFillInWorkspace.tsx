import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { StudentFillInWordViewer } from '@/components/student/StudentFillInWordViewer';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { normalizeScreenshotsByFillQuestion } from '@/lib/fillin';
import {
  ApiError,
  studentApi,
  type ExamPaperItem,
  type ExamSubmissionItem,
  type FillInPaperMeta,
  type FillInScreenshotInfo,
} from '@/lib/student';

type FillRow = ExamPaperItem | ExamSubmissionItem;

type StudentFillInWorkspaceProps = {
  examId: string;
  meta: FillInPaperMeta | null;
  items: FillRow[];
  answers: Record<string, string>;
  readOnly: boolean;
  showResult?: boolean;
  onAnswerChange: (examQuestionId: string, value: string) => void;
};

export function StudentFillInWorkspace({
  examId,
  meta,
  items,
  answers,
  readOnly,
  onAnswerChange,
}: StudentFillInWorkspaceProps) {
  const [downloading, setDownloading] = useState<'word' | 'attachment' | null>(
    null,
  );
  const [screenshotsByQuestion, setScreenshotsByQuestion] = useState<
    Record<string, FillInScreenshotInfo[]>
  >({});
  const hasAttachment = Boolean(meta?.hasAttachments);
  const fillRows = useMemo(
    () => items.filter((i) => i.type === 'FILL'),
    [items],
  );

  useEffect(() => {
    if (!examId || fillRows.length === 0) {
      setScreenshotsByQuestion({});
      return;
    }

    let cancelled = false;
    void studentApi
      .listFillInScreenshots(examId)
      .then((res) => {
        if (cancelled) return;
        setScreenshotsByQuestion(
          normalizeScreenshotsByFillQuestion(fillRows, res.items),
        );
      })
      .catch(() => {
        if (!cancelled) setScreenshotsByQuestion({});
      });

    return () => {
      cancelled = true;
    };
  }, [examId, fillRows]);

  const handleScreenshotsChange = useCallback(
    (examQuestionId: string, screenshots: FillInScreenshotInfo[]) => {
      setScreenshotsByQuestion((prev) => ({
        ...prev,
        [examQuestionId]: screenshots,
      }));
    },
    [],
  );

  async function handleDownloadWord() {
    if (!meta?.wordFileName) return;
    setDownloading('word');
    try {
      await studentApi.downloadFillInWord(examId, meta.wordFileName);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下载试卷失败');
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadAttachment() {
    if (!meta?.hasAttachments) return;
    setDownloading('attachment');
    try {
      await studentApi.downloadFillInAttachmentsZip(
        examId,
        meta.attachmentZipFileName ?? '填空题附件.zip',
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下载附件失败');
    } finally {
      setDownloading(null);
    }
  }

  const hasWord = Boolean(meta?.wordFileName);
  const wordDownloadLabel = meta?.wordFileName?.toLowerCase().endsWith('.html')
    ? '下载试卷'
    : '下载 Word 试卷';
  const showToolbar = Boolean(meta && (hasWord || hasAttachment));

  return (
    <div className="flex flex-col gap-3">
      {showToolbar ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span className="mr-1 shrink-0">资料：</span>
          {hasWord ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading === 'word'}
              onClick={() => void handleDownloadWord()}
            >
              {downloading === 'word' ? (
                <Spinner className="size-4" />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              {wordDownloadLabel}
            </Button>
          ) : null}
          {hasAttachment ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading === 'attachment'}
              onClick={() => void handleDownloadAttachment()}
            >
              {downloading === 'attachment' ? (
                <Spinner className="size-4" />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              下载附件（ZIP）
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0 rounded-lg border bg-card shadow-sm">
        {fillRows.length > 0 ? (
          <StudentFillInWordViewer
            examId={examId}
            items={items}
            answers={answers}
            readOnly={readOnly}
            onAnswerChange={onAnswerChange}
            screenshotsByQuestion={screenshotsByQuestion}
            onScreenshotsChange={handleScreenshotsChange}
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            本场考试暂无填空题。
          </p>
        )}
      </div>
    </div>
  );
}

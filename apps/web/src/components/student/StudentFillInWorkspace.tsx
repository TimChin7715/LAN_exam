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
  const [downloadingAttachment, setDownloadingAttachment] = useState(false);
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

  async function handleDownloadAttachment() {
    if (!meta?.hasAttachments) return;
    setDownloadingAttachment(true);
    try {
      await studentApi.downloadFillInAttachmentsZip(
        examId,
        meta.attachmentZipFileName ?? '操作题附件.zip',
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下载附件失败');
    } finally {
      setDownloadingAttachment(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {hasAttachment ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span className="mr-1 shrink-0">资料：</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloadingAttachment}
            onClick={() => void handleDownloadAttachment()}
          >
            {downloadingAttachment ? (
              <Spinner className="size-4" />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            下载附件（ZIP）
          </Button>
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
            本场考试暂无操作题。
          </p>
        )}
      </div>
    </div>
  );
}

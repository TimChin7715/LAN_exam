import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { StudentFillInAnswerSheet } from '@/components/student/StudentFillInAnswerSheet';
import { StudentFillInWordViewer } from '@/components/student/StudentFillInWordViewer';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
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
  showResult = false,
  onAnswerChange,
}: StudentFillInWorkspaceProps) {
  const [downloading, setDownloading] = useState<'word' | 'attachment' | null>(
    null,
  );
  const [screenshotsByQuestion, setScreenshotsByQuestion] = useState<
    Record<string, FillInScreenshotInfo[]>
  >({});
  const hasAttachment = Boolean(meta?.attachmentFileName);
  const fillRows = items.filter((i) => i.type === 'FILL');

  const loadScreenshots = useCallback(async () => {
    if (fillRows.length === 0) return;
    try {
      const res = await studentApi.listFillInScreenshots(examId);
      const map: Record<string, FillInScreenshotInfo[]> = {};
      for (const item of res.items) {
        map[item.examQuestionId] = item.screenshots;
      }
      setScreenshotsByQuestion(map);
    } catch {
      // 无填空或权限限制时不阻断答题
    }
  }, [examId, fillRows.length]);

  useEffect(() => {
    void loadScreenshots();
  }, [loadScreenshots]);

  function handleScreenshotsChange(
    examQuestionId: string,
    screenshots: FillInScreenshotInfo[],
  ) {
    setScreenshotsByQuestion((prev) => ({
      ...prev,
      [examQuestionId]: screenshots,
    }));
  }

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
    if (!meta?.attachmentFileName) return;
    setDownloading('attachment');
    try {
      await studentApi.downloadFillInAttachment(
        examId,
        meta.attachmentFileName,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下载附件失败');
    } finally {
      setDownloading(null);
    }
  }

  const hasWord = Boolean(meta?.wordFileName);
  const showToolbar = Boolean(meta && (hasWord || hasAttachment));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
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
              下载 Word 试卷
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
              下载 Excel/CSV 附件
            </Button>
          ) : null}
          {!readOnly ? (
            <span className="w-full text-xs sm:w-auto">
              左侧为试卷预览；请在右侧填写答案，并可上传或粘贴截图作为作答佐证。
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-3 overflow-hidden lg:grid-cols-2 lg:grid-rows-1 lg:gap-4">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
          <StudentFillInWordViewer examId={examId} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
          {fillRows.length > 0 ? (
            <StudentFillInAnswerSheet
              examId={examId}
              variant="panel"
              items={items}
              answers={answers}
              readOnly={readOnly}
              showResult={showResult}
              screenshotsByQuestion={screenshotsByQuestion}
              onScreenshotsChange={handleScreenshotsChange}
              onAnswerChange={onAnswerChange}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              本场考试暂无填空题。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

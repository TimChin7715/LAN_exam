import { useState } from 'react';
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

type DownloadKind = 'excel' | 'attachment';

export function StudentFillInWorkspace({
  examId,
  meta,
  items,
  answers,
  readOnly,
  showResult = false,
  onAnswerChange,
}: StudentFillInWorkspaceProps) {
  const [downloading, setDownloading] = useState<DownloadKind | null>(null);
  const hasAttachment = Boolean(meta?.attachmentFileName);
  const fillRows = items.filter((i) => i.type === 'FILL');

  async function handleDownload(kind: DownloadKind) {
    if (!meta) return;
    setDownloading(kind);
    try {
      if (kind === 'excel') {
        await studentApi.downloadFillInExcel(examId);
      } else if (meta.attachmentFileName) {
        await studentApi.downloadFillInAttachment(
          examId,
          meta.attachmentFileName,
        );
      }
    } catch (err) {
      const messages: Record<DownloadKind, string> = {
        excel: '下载答题卡失败',
        attachment: '下载附件失败',
      };
      toast.error(err instanceof ApiError ? err.message : messages[kind]);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {meta && !readOnly ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <span className="mr-1 shrink-0">辅助资料：</span>
          {hasAttachment ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading !== null}
              onClick={() => void handleDownload('attachment')}
            >
              {downloading === 'attachment' ? (
                <Spinner className="size-4" />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              下载 Excel/CSV 附件
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading !== null}
            onClick={() => void handleDownload('excel')}
          >
            {downloading === 'excel' ? (
              <Spinner className="size-4" />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            下载答题卡 Excel
          </Button>
          <span className="w-full text-xs sm:w-auto">
            左侧为试卷，请在右侧答题卡填写答案；系统将按空自动批改。
          </span>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-3 overflow-hidden lg:grid-cols-2 lg:grid-rows-1 lg:gap-4">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
          <StudentFillInWordViewer
            examId={examId}
            wordFileName={meta?.wordFileName}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
          {fillRows.length > 0 ? (
            <StudentFillInAnswerSheet
              variant="panel"
              items={items}
              answers={answers}
              readOnly={readOnly}
              showResult={showResult}
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

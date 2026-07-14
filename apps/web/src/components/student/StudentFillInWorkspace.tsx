import { useCallback, useEffect, useMemo, useState } from 'react';

import { StudentFillInWordViewer } from '@/components/student/StudentFillInWordViewer';
import { normalizeScreenshotsByFillQuestion } from '@/lib/fillin';
import {
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
  items,
  answers,
  readOnly,
  onAnswerChange,
}: StudentFillInWorkspaceProps) {
  const [screenshotsByQuestion, setScreenshotsByQuestion] = useState<
    Record<string, FillInScreenshotInfo[]>
  >({});
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

  return (
    <div className="flex flex-col gap-3">
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

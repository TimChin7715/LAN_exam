import { Fragment, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FillInScreenshotAttach } from '@/components/student/FillInScreenshotAttach';
import { displayFillAnswer, parseFillQuestionNo } from '@/lib/fillin';
import { formatStemForDisplay } from '@/lib/qbank';
import type {
  ExamPaperItem,
  ExamSubmissionItem,
  FillInScreenshotInfo,
} from '@/lib/student';

type FillRow = ExamPaperItem | ExamSubmissionItem;

type StudentFillInAnswerSheetProps = {
  examId: string;
  items: FillRow[];
  answers: Record<string, string>;
  readOnly: boolean;
  showResult?: boolean;
  /** 嵌入左右分栏右栏时使用，占满高度并可滚动 */
  variant?: 'card' | 'panel';
  screenshotsByQuestion: Record<string, FillInScreenshotInfo[]>;
  onScreenshotsChange: (
    examQuestionId: string,
    screenshots: FillInScreenshotInfo[],
  ) => void;
  onAnswerChange: (examQuestionId: string, value: string) => void;
};

export function StudentFillInAnswerSheet({
  examId,
  items,
  answers,
  readOnly,
  showResult = false,
  variant = 'card',
  screenshotsByQuestion,
  onScreenshotsChange,
  onAnswerChange,
}: StudentFillInAnswerSheetProps) {
  const rows = useMemo(
    () =>
      [...items]
        .filter((i) => i.type === 'FILL')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  const stemLeaderId = useMemo(() => {
    const leaders = new Map<string, string>();
    for (const row of rows) {
      const groupKey = row.fillQuestionNo ?? row.examQuestionId;
      if (!leaders.has(groupKey)) {
        leaders.set(groupKey, row.examQuestionId);
      }
    }
    return leaders;
  }, [rows]);

  const multiBlankByQuestion = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.fillQuestionNo ?? row.examQuestionId;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  if (rows.length === 0) return null;

  const table = (
    <div className="overflow-x-auto rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 shrink-0 text-left">题号</TableHead>
            <TableHead className="min-w-0">作答</TableHead>
            <TableHead className="w-14 shrink-0 text-right">分值</TableHead>
            {showResult ? (
              <TableHead className="w-24 shrink-0 text-right">结果</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
                const qNo =
                  parseFillQuestionNo(row.fillQuestionNo) ?? '—';
                const groupKey = row.fillQuestionNo ?? row.examQuestionId;
                const showStem = stemLeaderId.get(groupKey) === row.examQuestionId;
                const multiBlank =
                  (multiBlankByQuestion.get(groupKey) ?? 0) > 1;
                const submission =
                  showResult && 'isCorrect' in row
                    ? (row as ExamSubmissionItem)
                    : null;

                return (
                  <Fragment key={row.examQuestionId}>
                    {showStem && variant === 'card' ? (
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={showResult ? 4 : 3}>
                          <p className="text-sm font-medium text-muted-foreground">
                            第 {qNo} 题
                          </p>
                          <p className="mt-1 break-words text-base text-foreground">
                            {formatStemForDisplay(row.stem)}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    <TableRow>
                      <TableCell className="align-middle text-left font-bold tabular-nums">
                        {qNo}
                        {multiBlank && row.fillBlankIndex
                          ? `-${row.fillBlankIndex}`
                          : null}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                          <Input
                            className="bg-background"
                            value={displayFillAnswer(
                              answers[row.examQuestionId] ?? '',
                            )}
                            disabled={readOnly}
                            placeholder="请填写答案"
                            onChange={(e) =>
                              onAnswerChange(
                                row.examQuestionId,
                                e.target.value,
                              )
                            }
                          />
                          <FillInScreenshotAttach
                            examId={examId}
                            examQuestionId={row.examQuestionId}
                            screenshots={
                              screenshotsByQuestion[row.examQuestionId] ?? []
                            }
                            readOnly={readOnly}
                            onScreenshotsChange={onScreenshotsChange}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-right font-bold tabular-nums">
                        {row.points}
                      </TableCell>
                      {showResult && submission ? (
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              submission.isCorrect ? 'default' : 'outline'
                            }
                          >
                            {submission.isCorrect ? '正确' : '错误'}（
                            {submission.pointsAwarded} 分）
                          </Badge>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  </Fragment>
                );
              })}
        </TableBody>
      </Table>
    </div>
  );

  if (variant === 'panel') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-3 py-2">
          <p className="text-sm font-medium text-foreground">答题卡</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
          {table}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">填空题答题卡</CardTitle>
      </CardHeader>
      <CardContent>{table}</CardContent>
    </Card>
  );
}

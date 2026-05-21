import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';

import { QuestionPreviewCards } from '@/components/admin/qbank/QuestionPreviewCards';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  downloadExamExport,
  downloadPracticalAnswer,
  endExam,
  examContentModulesLabel,
  hasExamModule,
  examStatusLabel,
  fetchExamSeats,
  fetchExamSubmissions,
  formatExamDateTime,
  formatExamScheduleRange,
  getExam,
  handleExamApiError,
  startExam,
  type ExamDetail,
  type ExamSeatBoard,
  type SubmissionListItem,
} from '@/lib/exam';
import { ExamSeatBoardPanel } from '@/components/exam/ExamSeatBoardPanel';
import { fetchAdminSettings } from '@/lib/admin-settings';
import { maskNationalId } from '@/lib/roster';
import type { PreviewQuestion } from '@/lib/qbank';

export default function AdminExamDetail() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [showSeatBoard, setShowSeatBoard] = useState(true);
  const [seatBoard, setSeatBoard] = useState<ExamSeatBoard | null>(null);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const [examData, submissionItems] = await Promise.all([
        getExam(examId),
        fetchExamSubmissions(examId),
      ]);
      setExam(examData);
      setSubmissions(submissionItems);
    } catch (err) {
      handleExamApiError(err, '无法加载考试详情。');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await fetchAdminSettings();
        if (!cancelled) setShowSeatBoard(settings.showSeatBoard);
      } catch (err) {
        if (!cancelled) handleExamApiError(err, '无法加载设置。');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!examId || !showSeatBoard) {
      setSeatBoard(null);
      setSeatsError(null);
      setSeatsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSeatsLoading(true);
      setSeatsError(null);
      try {
        const board = await fetchExamSeats(examId);
        if (!cancelled) setSeatBoard(board);
      } catch (err) {
        if (!cancelled) {
          handleExamApiError(err, '无法加载考生座位信息。');
          setSeatsError('无法加载考生座位信息。');
        }
      } finally {
        if (!cancelled) setSeatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, showSeatBoard]);

  async function handleStart() {
    if (!examId) return;
    setActionLoading(true);
    try {
      await startExam(examId);
      toast.success('考试已开始。');
      await load();
    } catch (err) {
      handleExamApiError(err, '开始考试失败。');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExport() {
    if (!examId || !exam) return;
    setExporting(true);
    try {
      await downloadExamExport(examId, exam.title);
      toast.success('导出已开始下载。');
    } catch (err) {
      handleExamApiError(err, '导出失败。');
    } finally {
      setExporting(false);
    }
  }

  async function handleEnd() {
    if (!examId) return;
    setActionLoading(true);
    try {
      await endExam(examId);
      toast.success('考试已结束。');
      await load();
    } catch (err) {
      handleExamApiError(err, '结束考试失败。');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !exam) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const previewQuestions: PreviewQuestion[] = exam.questions.map((eq) => ({
    type: eq.question.type,
    stem: eq.question.stem,
    answerKeys: eq.question.answerKeys,
    points: eq.question.points,
    options: eq.question.options,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/exams">
            <ArrowLeft className="size-4" aria-hidden />
            返回列表
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{exam.title}</h1>
        <Badge variant="secondary">{examStatusLabel(exam.status)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">考试配置</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2 text-sm text-muted-foreground">
          <p>考试内容：{examContentModulesLabel(exam.contentModules)}</p>
          {exam.questionBatch ? (
            <p>客观题批次：{exam.questionBatch.fileName}</p>
          ) : null}
          {exam.fillInBatch ? (
            <p>
              填空题批次：{exam.fillInBatch.title}（{exam.fillInBatch.wordFileName}、
              {exam.fillInBatch.excelFileName}）
            </p>
          ) : null}
          {exam.practicalBatch ? (
            <p>
              操作题批次：{exam.practicalBatch.title}（{exam.practicalBatch.wordFileName}
              、{exam.practicalBatch.excelFileName}）
            </p>
          ) : null}
          <p>名单批次：{exam.rosterBatch.fileName}</p>
          {hasExamModule(exam.contentModules, 'OBJECTIVE') ||
          hasExamModule(exam.contentModules, 'FILL') ? (
            <p>试题数量（客观+填空）：{exam.questions.length}</p>
          ) : null}
          {hasExamModule(exam.contentModules, 'PRACTICAL') ? (
            <p className="text-amber-700 dark:text-amber-400">
              操作题需人工评阅，系统不自动计分。
            </p>
          ) : null}
          <p>
            计划时间：
            {formatExamScheduleRange(exam.scheduledStartAt, exam.scheduledEndAt)}
          </p>
          {exam.startedAt ? (
            <p>实际开始：{formatExamDateTime(exam.startedAt)}</p>
          ) : null}
          {exam.endedAt ? <p>实际结束：{formatExamDateTime(exam.endedAt)}</p> : null}
          <div className="flex flex-wrap gap-2 pt-2">
            {exam.status === 'DRAFT' ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={actionLoading}>开始考试</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认开始考试？</AlertDialogTitle>
                    <AlertDialogDescription>
                      开始后名单内考生可在准备页进入答题。同一名单批次同时只能有一场进行中的考试。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleStart()}>
                      开始考试
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            {exam.status === 'IN_PROGRESS' || exam.status === 'ENDED' ? (
              <Button
                variant="outline"
                disabled={exporting}
                onClick={() => void handleExport()}
              >
                <Download className="size-4" aria-hidden />
                {exporting ? '导出中…' : '导出成绩与明细'}
              </Button>
            ) : null}
            {exam.status === 'IN_PROGRESS' ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={actionLoading}>
                    结束考试
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认结束考试？</AlertDialogTitle>
                    <AlertDialogDescription>
                      结束后考生将无法继续保存或提交作答。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleEnd()}>
                      结束考试
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
          </div>
          {showSeatBoard ? (
            <ExamSeatBoardPanel
              mode="admin"
              board={seatBoard}
              loading={seatsLoading}
              error={seatsError}
            />
          ) : null}
        </CardContent>
      </Card>

      {(hasExamModule(exam.contentModules, 'OBJECTIVE') ||
        hasExamModule(exam.contentModules, 'FILL')) &&
      exam.questions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">试题预览（含标准答案）</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionPreviewCards questions={previewQuestions} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">成绩列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>单位</TableHead>
                <TableHead>身份证号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>试题得分</TableHead>
                {hasExamModule(exam.contentModules, 'PRACTICAL') ? (
                  <TableHead>操作题</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((row) => (
                <TableRow key={row.rosterEntryId}>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>{row.organization}</TableCell>
                  <TableCell>{maskNationalId(row.nationalId)}</TableCell>
                  <TableCell>
                    {row.submitted ? (
                      <Badge>已提交</Badge>
                    ) : (
                      <Badge variant="outline">未提交</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!hasExamModule(exam.contentModules, 'OBJECTIVE') &&
                    !hasExamModule(exam.contentModules, 'FILL')
                      ? '—'
                      : row.submitted && row.totalScore !== null
                        ? row.totalScore
                        : '—'}
                  </TableCell>
                  {hasExamModule(exam.contentModules, 'PRACTICAL') ? (
                    <TableCell>
                      {row.practicalSubmitted && examId ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void downloadPracticalAnswer(
                              examId,
                              row.rosterEntryId,
                              `${row.fullName}-操作题`,
                            )
                          }
                        >
                          下载答卷
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">未提交</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

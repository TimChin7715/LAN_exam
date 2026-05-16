import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
  endExam,
  examStatusLabel,
  fetchExamSubmissions,
  getExam,
  handleExamApiError,
  startExam,
  type ExamDetail,
  type SubmissionListItem,
} from '@/lib/exam';
import { maskNationalId } from '@/lib/roster';
import type { PreviewQuestion } from '@/lib/qbank';

export default function AdminExamDetail() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>题目批次：{exam.questionBatch.fileName}</p>
          <p>名单批次：{exam.rosterBatch.fileName}</p>
          <p>题目数量：{exam.questions.length}</p>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">题目预览（含标准答案）</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionPreviewCards questions={previewQuestions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">成绩列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>身份证号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>得分</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((row) => (
                <TableRow key={row.rosterEntryId}>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>{maskNationalId(row.nationalId)}</TableCell>
                  <TableCell>
                    {row.submitted ? (
                      <Badge>已提交</Badge>
                    ) : (
                      <Badge variant="outline">未提交</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.submitted ? row.totalScore : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

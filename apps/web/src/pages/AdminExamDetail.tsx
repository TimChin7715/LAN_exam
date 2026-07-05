import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';

import { QuestionPreviewCards } from '@/components/admin/qbank/QuestionPreviewCards';
import {
  AdminDataTable,
  AdminSectionCard,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/admin/AdminPagePrimitives';
import { adminMeta, adminPageTitle } from '@/components/admin/admin-typography';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  downloadExamExport,
  downloadFillInScreenshots,
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
  retakeExamSubmission,
  startExam,
  toDatetimeLocalValue,
  updateExamSchedule,
  type ExamDetail,
  type ExamSeatBoard,
  type SubmissionListItem,
} from '@/lib/exam';
import { RosterListSection } from '@/components/admin/roster/RosterListSection';
import { ExamSeatBoardPanel } from '@/components/exam/ExamSeatBoardPanel';
import { fetchAdminSettings } from '@/lib/admin-settings';
import { ApiError } from '@/lib/api';
import { maskNationalId } from '@/lib/roster';
import { cn } from '@/lib/utils';
import type { PreviewQuestion } from '@/lib/qbank';

const ADMIN_SUBMISSIONS_POLL_INTERVAL_MS = 10_000;

export default function AdminExamDetail() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [showSeatBoard, setShowSeatBoard] = useState(false);
  const [seatBoard, setSeatBoard] = useState<ExamSeatBoard | null>(null);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingScreenshots, setExportingScreenshots] = useState(false);
  const [retakingEntryId, setRetakingEntryId] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

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
      setScheduleStart(
        examData.scheduledStartAt
          ? toDatetimeLocalValue(examData.scheduledStartAt)
          : '',
      );
      setScheduleEnd(
        examData.scheduledEndAt ? toDatetimeLocalValue(examData.scheduledEndAt) : '',
      );
    } catch (err) {
      handleExamApiError(err, '无法加载考试详情。');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  const refreshSubmissions = useCallback(async () => {
    if (!examId) return;
    try {
      const submissionItems = await fetchExamSubmissions(examId);
      setSubmissions(submissionItems);
    } catch {
      /* 轮询失败不打扰考官 */
    }
  }, [examId]);

  const reloadSeats = useCallback(async () => {
    if (!examId || !showSeatBoard) return;
    setSeatsLoading(true);
    setSeatsError(null);
    try {
      const board = await fetchExamSeats(examId);
      setSeatBoard(board);
    } catch (err) {
      handleExamApiError(err, '无法加载考生座位信息。');
      setSeatsError('无法加载考生座位信息。');
    } finally {
      setSeatsLoading(false);
    }
  }, [examId, showSeatBoard]);

  const handleRosterEntriesChanged = useCallback(() => {
    void load();
    void refreshSubmissions();
    if (showSeatBoard) {
      void reloadSeats();
    }
  }, [load, refreshSubmissions, reloadSeats, showSeatBoard]);

  async function handleSaveSchedule() {
    if (!examId || !exam) return;
    if (exam.status !== 'DRAFT' && exam.status !== 'IN_PROGRESS') {
      toast.error('仅草稿或进行中状态的考试可以编辑时间。');
      return;
    }
    if (!scheduleStart || !scheduleEnd) {
      toast.error('请填写开始时间与结束时间。');
      return;
    }
    const startIso = new Date(scheduleStart).toISOString();
    const endIso = new Date(scheduleEnd).toISOString();
    if (!(new Date(endIso) > new Date(startIso))) {
      toast.error('结束时间必须晚于开始时间。');
      return;
    }
    setSavingSchedule(true);
    try {
      await updateExamSchedule(examId, {
        scheduledStartAt: startIso,
        scheduledEndAt: endIso,
      });
      toast.success('考试时间已更新');
      await load();
    } catch (err) {
      handleExamApiError(err, '更新考试时间失败。');
    } finally {
      setSavingSchedule(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!examId || exam?.status !== 'IN_PROGRESS') return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const poll = () => {
      if (document.hidden) return;
      void refreshSubmissions();
    };

    const startPolling = () => {
      if (intervalId !== undefined) return;
      void poll();
      intervalId = setInterval(() => {
        void poll();
      }, ADMIN_SUBMISSIONS_POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId === undefined) return;
      clearInterval(intervalId);
      intervalId = undefined;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    if (!document.hidden) {
      startPolling();
    }

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [examId, exam?.status, refreshSubmissions]);

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
    void reloadSeats();
  }, [examId, showSeatBoard, reloadSeats]);

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

  async function handleExportFillInScreenshots() {
    if (!examId || !exam) return;
    setExportingScreenshots(true);
    try {
      await downloadFillInScreenshots(examId, exam.title);
      toast.success('操作题截图导出已开始下载。');
    } catch (err) {
      if (!(err instanceof ApiError)) {
        handleExamApiError(err, '导出操作题截图失败。');
      }
    } finally {
      setExportingScreenshots(false);
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

  async function handleRetake(rosterEntryId: string, fullName: string) {
    if (!examId) return;
    setRetakingEntryId(rosterEntryId);
    try {
      await retakeExamSubmission(examId, rosterEntryId);
      toast.success(`${fullName} 已允许重考，需重新答题。`);
      await load();
    } catch (err) {
      handleExamApiError(err, '重考操作失败。');
    } finally {
      setRetakingEntryId(null);
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" asChild>
          <Link to="/admin/exams">
            <ArrowLeft className="size-5" aria-hidden />
            返回列表
          </Link>
        </Button>
        <h1 className={adminPageTitle}>{exam.title}</h1>
        <Badge variant="secondary">
          {examStatusLabel(exam.status)}
        </Badge>
      </div>

      <AdminSectionCard title="考试配置" contentClassName="space-y-6">
          <div className="grid gap-8 lg:grid-cols-2">
          <div className={cn('space-y-3 leading-relaxed', adminMeta)}>
          <p>考试内容：{examContentModulesLabel(exam.contentModules)}</p>
          {exam.questionBatch ? (
            <p>客观题批次：{exam.questionBatch.fileName}</p>
          ) : null}
          {exam.fillInBatch ? (
            <p>
              操作题批次：{exam.fillInBatch.title}（{exam.fillInBatch.wordFileName}
              {exam.fillInBatch.excelFileName
                ? `、${exam.fillInBatch.excelFileName}`
                : ''}
              ）
            </p>
          ) : null}
          <p>名单批次：{exam.rosterBatch.fileName}</p>
          {hasExamModule(exam.contentModules, 'OBJECTIVE') ||
          hasExamModule(exam.contentModules, 'FILL') ? (
            <p>试题数量（客观+操作）：{exam.questions.length}</p>
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
              <>
                <Button
                  variant="outline"
                  disabled={exporting}
                  onClick={() => void handleExport()}
                >
                  <Download className="size-4" aria-hidden />
                  {exporting ? '导出中…' : '导出成绩与明细'}
                </Button>
                {hasExamModule(exam.contentModules, 'FILL') ? (
                  <Button
                    variant="outline"
                    disabled={exportingScreenshots}
                    onClick={() => void handleExportFillInScreenshots()}
                  >
                    <Download className="size-4" aria-hidden />
                    {exportingScreenshots
                      ? '导出中…'
                      : '导出操作题截图'}
                  </Button>
                ) : null}
              </>
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
          </div>

          <div className="space-y-4 border-t border-border pt-6">
            <p className="font-medium text-foreground">修改计划时间</p>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-nowrap sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="scheduleStart">开始时间</Label>
                <Input
                  id="scheduleStart"
                  type="datetime-local"
                  className="w-full sm:w-[13.5rem]"
                  value={scheduleStart}
                  disabled={
                    (exam.status !== 'DRAFT' && exam.status !== 'IN_PROGRESS') ||
                    savingSchedule
                  }
                  onChange={(e) => setScheduleStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduleEnd">结束时间</Label>
                <Input
                  id="scheduleEnd"
                  type="datetime-local"
                  className="w-full sm:w-[13.5rem]"
                  value={scheduleEnd}
                  disabled={
                    (exam.status !== 'DRAFT' && exam.status !== 'IN_PROGRESS') ||
                    savingSchedule
                  }
                  onChange={(e) => setScheduleEnd(e.target.value)}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  className="shrink-0"
                  disabled={
                    (exam.status !== 'DRAFT' && exam.status !== 'IN_PROGRESS') ||
                    savingSchedule
                  }
                  onClick={() => void handleSaveSchedule()}
                >
                  {savingSchedule ? '修改中…' : '修改时间'}
                </Button>
                {exam.status !== 'DRAFT' && exam.status !== 'IN_PROGRESS' ? (
                  <p className={cn(adminMeta, 'shrink-0 whitespace-nowrap')}>
                    仅草稿/进行中允许修改计划时间。
                  </p>
                ) : null}
              </div>
            </div>
          </div>
      </AdminSectionCard>

      {(hasExamModule(exam.contentModules, 'OBJECTIVE') ||
        hasExamModule(exam.contentModules, 'FILL')) &&
      exam.questions.length > 0 ? (
        <AdminSectionCard title="试题预览（含标准答案）">
            <QuestionPreviewCards questions={previewQuestions} size="large" />
        </AdminSectionCard>
      ) : null}

      <RosterListSection
        batchId={exam.rosterBatch.id}
        title="当次考试名单"
        readOnly={exam.status === 'ENDED'}
        onEntriesChanged={handleRosterEntriesChanged}
      />

      <AdminSectionCard title="成绩列表">
          <AdminDataTable>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>单位</TableHead>
                <TableHead>身份证号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>试题得分</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((row) => (
                <TableRow key={row.rosterEntryId}>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>{row.organization}</TableCell>
                  <TableCell>{maskNationalId(row.nationalId)}</TableCell>
                  <TableCell>
                    {row.statusLabel === 'absent' ? (
                      <Badge variant="destructive">缺考</Badge>
                    ) : row.statusLabel === 'submitted' || row.submitted ? (
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
                  <TableCell>
                    {row.submitted && exam.status === 'IN_PROGRESS' ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={retakingEntryId === row.rosterEntryId}
                          >
                            {retakingEntryId === row.rosterEntryId
                              ? '处理中…'
                              : '重考'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              确认允许 {row.fullName} 重考？
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              将清空该考生本次提交记录与作答文件，考生需重新答题后再提交。此操作不可恢复已提交的成绩记录。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                void handleRetake(
                                  row.rosterEntryId,
                                  row.fullName,
                                )
                              }
                            >
                              确认重考
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </AdminDataTable>
      </AdminSectionCard>
    </div>
  );
}

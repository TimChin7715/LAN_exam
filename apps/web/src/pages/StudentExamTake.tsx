import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ObjectiveOptionTiles } from '@/components/student/ObjectiveOptionTiles';
import { StudentExamAnswerOverview } from '@/components/student/StudentExamAnswerOverview';
import { StudentFillInWorkspace } from '@/components/student/StudentFillInWorkspace';
import { StudentPracticalSection } from '@/components/student/StudentPracticalSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  buildAnswerProgressSummary,
  collectSubmitBlockers,
  formatSubmitConfirmDescription,
} from '@/lib/exam-submit-validation';
import { formatExamRemaining } from '@/lib/exam-countdown';
import { formatStemForDisplay, questionTypeLabel } from '@/lib/qbank';
import {
  ApiError,
  computeExamSyncInitialDelayMs,
  hasExamModule,
  needsPractical,
  needsQuestionItems,
  SERVER_BUSY_CODE,
  STUDENT_ACTIVE_EXAM_POLL_INTERVAL_MS,
  STUDENT_ALREADY_SUBMITTED_MESSAGE,
  STUDENT_EXAM_ENDED_CODE,
  STUDENT_EXAM_SYNC_INTERVAL_MS,
  STUDENT_EXAM_SYNC_JITTER_MS,
  studentApi,
  type ExamContentModule,
  type ExamPaperItem,
  type ExamSubmissionItem,
  type FillInPaperMeta,
  type PracticalPaperMeta,
} from '@/lib/student';
import { cn } from '@/lib/utils';

type AnswerState = Record<string, string>;
type DirtyAnswerState = Record<string, string>;

function parseMultiKeys(raw: string): string[] {
  return raw
    .split(/[,\uFF0C\u3001\s]+/)
    .map((k) => k.trim().toUpperCase())
    .filter((k) => /^[A-Z]$/.test(k));
}

function joinMultiKeys(keys: string[]): string {
  return [...new Set(keys)].sort().join(',');
}

function formatProgressSyncedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StudentExamTake() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get('examId') ?? '';
  const [examTitle, setExamTitle] = useState<string | null>(null);

  const goToExamEnded = useCallback(() => {
    if (!examId) return;
    navigate(`/exam/ended?examId=${encodeURIComponent(examId)}`, {
      replace: true,
    });
  }, [examId, navigate]);

  const [contentModules, setContentModules] = useState<ExamContentModule[]>([
    'OBJECTIVE',
  ]);
  const [items, setItems] = useState<(ExamPaperItem | ExamSubmissionItem)[]>([]);
  const [fillIn, setFillIn] = useState<FillInPaperMeta | null>(null);
  const [practical, setPractical] = useState<PracticalPaperMeta | null>(null);
  const [practicalSubmittedName, setPracticalSubmittedName] = useState<
    string | null
  >(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [progressSyncedAt, setProgressSyncedAt] = useState<string | null>(null);
  const [syncingProgress, setSyncingProgress] = useState(false);
  const [scheduledEndAt, setScheduledEndAt] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const dirtyAnswersRef = useRef<DirtyAnswerState>({});
  const answersRef = useRef<AnswerState>({});
  const itemsRef = useRef<(ExamPaperItem | ExamSubmissionItem)[]>([]);
  const nationalIdRef = useRef<string | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const syncRetryToastShownRef = useRef(false);
  const isMountedRef = useRef(true);
  const paperRetryToastShownRef = useRef(false);
  const autoSubmitInFlightRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  const resetPendingSaveState = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    dirtyAnswersRef.current = {};
    if (isMountedRef.current) {
      setSaveStatus('idle');
    }
  }, []);

  const loadExam = useCallback(async () => {
    if (!examId) {
      resetPendingSaveState();
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await studentApi.selectExam(examId);

      try {
        const submission = await studentApi.examSubmission(examId);
        resetPendingSaveState();
        setExamTitle(submission.title);
        setContentModules(submission.contentModules);
        setFillIn(null);
        setItems(submission.items);
        setAnswers(
          Object.fromEntries(
            submission.items.map((item) => [item.examQuestionId, item.selectedKeys]),
          ),
        );
        setPractical(null);
        setPracticalSubmittedName(submission.practical?.docxFileName ?? null);
        setReadOnly(true);
        return;
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err;
        }
      }

      const paper = await studentApi.examPaper(examId, {
        onRetry: () => {
          if (!paperRetryToastShownRef.current) {
            paperRetryToastShownRef.current = true;
            toast.message('加载排队中，请稍候…');
          }
        },
      });
      paperRetryToastShownRef.current = false;
      resetPendingSaveState();
      setExamTitle(paper.title);
      setContentModules(paper.contentModules);
      setItems(paper.items);
      setFillIn(paper.fillIn);
      setPractical(paper.practical);
      setPracticalSubmittedName(null);
      setScheduledEndAt(paper.scheduledEndAt);
      setAnswers(
        Object.fromEntries(
          paper.items.map((item) => [item.examQuestionId, item.selectedKeys ?? '']),
        ),
      );
      setReadOnly(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === STUDENT_EXAM_ENDED_CODE) {
        goToExamEnded();
        return;
      }
      if (err instanceof ApiError) {
        toast.error(err.message || '无法加载试卷。');
      } else {
        toast.error('无法加载试卷。');
      }
    } finally {
      setLoading(false);
    }
  }, [examId, goToExamEnded, resetPendingSaveState]);

  useEffect(() => {
    void loadExam();
  }, [loadExam]);

  const persistDirtyAnswers = useCallback(async () => {
    if (readOnly || !examId) return;
    if (saveInFlightRef.current) {
      await saveInFlightRef.current;
      return;
    }

    const payload = Object.entries(dirtyAnswersRef.current).map(
      ([examQuestionId, selectedKeys]) => ({
        examQuestionId,
        selectedKeys,
      }),
    );
    if (payload.length === 0) return;

    const saveTask = (async () => {
      if (isMountedRef.current) {
        setSaveStatus('saving');
      }
      try {
        await studentApi.saveAnswers(examId, payload);
        for (const item of payload) {
          if (dirtyAnswersRef.current[item.examQuestionId] === item.selectedKeys) {
            delete dirtyAnswersRef.current[item.examQuestionId];
          }
        }
        if (isMountedRef.current) {
          setSaveStatus(
            Object.keys(dirtyAnswersRef.current).length === 0 ? 'saved' : 'idle',
          );
        }
      } catch (err) {
        if (isMountedRef.current) {
          setSaveStatus('idle');
        }
        if (err instanceof ApiError && err.code === STUDENT_EXAM_ENDED_CODE) {
          goToExamEnded();
          throw err;
        }
        if (err instanceof ApiError) {
          toast.error(err.message || '保存答案失败。');
        }
        throw err;
      } finally {
        saveInFlightRef.current = null;
      }
    })();

    saveInFlightRef.current = saveTask;
    await saveTask;
  }, [examId, goToExamEnded, readOnly]);

  const flushDirtyAnswers = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    try {
      while (!readOnly && examId) {
        if (saveInFlightRef.current) {
          await saveInFlightRef.current;
          continue;
        }
        if (Object.keys(dirtyAnswersRef.current).length === 0) {
          return true;
        }
        await persistDirtyAnswers();
      }
      return true;
    } catch {
      return false;
    }
  }, [examId, persistDirtyAnswers, readOnly]);

  const runProgressSync = useCallback(async () => {
    if (readOnly || !examId || !needsQuestionItems(contentModules)) {
      return;
    }

    const payload = itemsRef.current
      .map((item) => ({
        examQuestionId: item.examQuestionId,
        selectedKeys: (answersRef.current[item.examQuestionId] ?? '').trim(),
      }))
      .filter((item) => item.selectedKeys.length > 0);

    if (payload.length === 0) {
      return;
    }

    if (syncInFlightRef.current) {
      await syncInFlightRef.current;
      return;
    }

    const syncTask = (async () => {
      if (isMountedRef.current) {
        setSyncingProgress(true);
      }
      try {
        const result = await studentApi.syncProgress(examId, payload, {
          onRetry: () => {
            if (!syncRetryToastShownRef.current) {
              syncRetryToastShownRef.current = true;
              toast.message('进度同步排队中，请稍候…');
            }
          },
        });
        syncRetryToastShownRef.current = false;
        for (const item of payload) {
          if (
            dirtyAnswersRef.current[item.examQuestionId] === item.selectedKeys
          ) {
            delete dirtyAnswersRef.current[item.examQuestionId];
          }
        }
        if (isMountedRef.current) {
          setProgressSyncedAt(result.syncedAt);
          if (Object.keys(dirtyAnswersRef.current).length === 0) {
            setSaveStatus('saved');
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === STUDENT_EXAM_ENDED_CODE) {
          goToExamEnded();
          throw err;
        }
        if (err instanceof ApiError && err.code === SERVER_BUSY_CODE) {
          toast.error(err.message || '进度同步排队已满，将稍后重试。');
        }
      } finally {
        if (isMountedRef.current) {
          setSyncingProgress(false);
        }
        syncInFlightRef.current = null;
      }
    })();

    syncInFlightRef.current = syncTask;
    await syncTask;
  }, [contentModules, examId, goToExamEnded, readOnly]);

  useEffect(() => {
    if (!examId || readOnly || loading || !needsQuestionItems(contentModules)) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const scheduleRepeating = () => {
      intervalId = setInterval(
        () => void runProgressSync(),
        STUDENT_EXAM_SYNC_INTERVAL_MS,
      );
    };

    const startSyncLoop = () => {
      const nationalId = nationalIdRef.current ?? '';
      const initialDelay = nationalId
        ? computeExamSyncInitialDelayMs(nationalId)
        : Math.floor(Math.random() * STUDENT_EXAM_SYNC_JITTER_MS);

      timeoutId = setTimeout(() => {
        if (cancelled) return;
        void runProgressSync();
        scheduleRepeating();
      }, initialDelay);
    };

    if (nationalIdRef.current) {
      startSyncLoop();
    } else {
      void studentApi
        .me()
        .then((profile) => {
          if (cancelled) return;
          nationalIdRef.current = profile.nationalId;
          startSyncLoop();
        })
        .catch(() => {
          if (!cancelled) startSyncLoop();
        });
    }

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, [contentModules, examId, loading, readOnly, runProgressSync]);

  const goToExamSubmitted = useCallback(() => {
    if (!examId) return;
    navigate(`/exam/submitted?examId=${encodeURIComponent(examId)}`, {
      replace: true,
    });
  }, [examId, navigate]);

  const performAutoSubmit = useCallback(async () => {
    if (!examId || readOnly || autoSubmitInFlightRef.current) return;
    autoSubmitInFlightRef.current = true;
    setAutoSubmitting(true);
    toast.message('考试时间已到，正在自动提交试卷…');
    try {
      const flushed = await flushDirtyAnswers();
      if (!flushed) {
        return;
      }
      await studentApi.submitExam(examId);
      goToExamSubmitted();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === STUDENT_EXAM_ENDED_CODE) {
          goToExamEnded();
          return;
        }
        if (err.status === 409) {
          goToExamSubmitted();
          return;
        }
        if (err.code === SERVER_BUSY_CODE) {
          toast.error(err.message || '交卷排队已满，将稍后重试。');
        } else {
          toast.error(err.message || '自动交卷失败，请稍候重试。');
        }
      }
    } finally {
      autoSubmitInFlightRef.current = false;
      setAutoSubmitting(false);
    }
  }, [examId, flushDirtyAnswers, goToExamEnded, goToExamSubmitted, readOnly]);

  useEffect(() => {
    if (!scheduledEndAt || readOnly || loading) {
      setRemainingMs(null);
      return;
    }

    const endMs = new Date(scheduledEndAt).getTime();
    const tick = () => {
      const left = endMs - Date.now();
      setRemainingMs(left);
      if (left <= 0) {
        void performAutoSubmit();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [loading, performAutoSubmit, readOnly, scheduledEndAt]);

  useEffect(() => {
    if (!examId || readOnly || loading) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      if (document.hidden) return;
      try {
        const status = await studentApi.examStatus();
        if (status.status === 'DEADLINE_REACHED' && status.examId === examId) {
          void performAutoSubmit();
          return;
        }
        if (status.status === 'ENDED' && status.examId === examId) {
          goToExamEnded();
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    const startPolling = () => {
      if (intervalId !== undefined) return;
      void poll();
      intervalId = setInterval(
        () => void poll(),
        STUDENT_ACTIVE_EXAM_POLL_INTERVAL_MS,
      );
    };

    const stopPolling = () => {
      if (intervalId === undefined) return;
      clearInterval(intervalId);
      intervalId = undefined;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
        void flushDirtyAnswers();
      } else {
        startPolling();
        void runProgressSync();
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
  }, [
    examId,
    flushDirtyAnswers,
    goToExamEnded,
    loading,
    performAutoSubmit,
    readOnly,
    runProgressSync,
  ]);

  const scheduleSave = useCallback(() => {
    if (readOnly || !examId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushDirtyAnswers();
    }, 2000);
  }, [examId, flushDirtyAnswers, readOnly]);

  function updateAnswer(examQuestionId: string, value: string) {
    if (readOnly) return;
    setAnswers((prev) => ({ ...prev, [examQuestionId]: value }));
    dirtyAnswersRef.current[examQuestionId] = value;
    setSaveStatus('idle');
    scheduleSave();
  }

  function toggleMulti(examQuestionId: string, key: string, checked: boolean) {
    const current = parseMultiKeys(answers[examQuestionId] ?? '');
    const next = checked
      ? [...current, key]
      : current.filter((item) => item !== key);
    updateAnswer(examQuestionId, joinMultiKeys(next));
  }

  const fillItems = useMemo(
    () =>
      items
        .filter((item) => item.type === 'FILL')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );
  const objectiveItems = useMemo(
    () =>
      items
        .filter((item) => item.type !== 'FILL')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  async function handleLogout() {
    setLoggingOut(true);
    try {
      if (!readOnly) {
        await flushDirtyAnswers();
      }
      await studentApi.logout();
      setLogoutOpen(false);
    } finally {
      setLoggingOut(false);
      navigate('/exam/login', { replace: true });
    }
  }

  async function tryOpenSubmitDialog() {
    if (!examId || readOnly) return;

    const flushed = await flushDirtyAnswers();
    if (!flushed) {
      return;
    }

    setSubmitOpen(true);
  }

  async function handleSubmit() {
    if (!examId || readOnly) return;

    setSubmitting(true);
    try {
      const flushed = await flushDirtyAnswers();
      if (!flushed) {
        return;
      }

      await studentApi.submitExam(examId);
      setSubmitOpen(false);
      goToExamSubmitted();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === STUDENT_EXAM_ENDED_CODE) {
          goToExamEnded();
          return;
        }
        if (err.status === 409) {
          toast.error(STUDENT_ALREADY_SUBMITTED_MESSAGE);
          goToExamSubmitted();
        } else if (err.code === SERVER_BUSY_CODE) {
          toast.error(
            err.message || '交卷排队已满，请稍候再点「确认提交」。',
          );
        } else {
          toast.error(err.message || '提交试卷失败。');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const saveLabel = useMemo(() => {
    if (readOnly || !needsQuestionItems(contentModules)) return null;
    if (saveStatus === 'saving') return '正在保存答案...';
    if (saveStatus === 'saved') return '答案已保存';
    return '答案将自动保存';
  }, [contentModules, readOnly, saveStatus]);

  const progressSyncLabel = useMemo(() => {
    if (readOnly || !needsQuestionItems(contentModules)) return null;
    if (syncingProgress) return '正在同步进度至服务器…';
    if (progressSyncedAt) {
      return `进度已同步至服务器 ${formatProgressSyncedAt(progressSyncedAt)}`;
    }
    return null;
  }, [contentModules, progressSyncedAt, readOnly, syncingProgress]);

  const answerProgress = useMemo(
    () =>
      buildAnswerProgressSummary({
        items,
        answers,
        contentModules,
        practical,
      }),
    [items, answers, contentModules, practical],
  );

  const submitBlockers = useMemo(
    () =>
      collectSubmitBlockers({
        items,
        answers,
        contentModules,
        practical,
      }),
    [items, answers, contentModules, practical],
  );

  const submitConfirmDescription = useMemo(
    () => formatSubmitConfirmDescription(submitBlockers),
    [submitBlockers],
  );

  if (!examId) {
    return (
      <Alert variant="destructive">
        <AlertDescription>缺少考试参数，请从准备页重新进入。</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const hasObjectiveModule = hasExamModule(contentModules, 'OBJECTIVE');
  const hasFillModule = hasExamModule(contentModules, 'FILL');
  const hasPracticalModule = needsPractical(contentModules);
  const pageMaxWidth = hasFillModule ? 'max-w-[96rem]' : 'max-w-3xl';

  return (
    <>
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
            <AlertDialogDescription>
              退出后需重新验证身份才能登录。已自动保存的作答会保留，重新登录后可继续本场考试。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              {loggingOut ? '退出中…' : '确认退出'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!readOnly ? (
        <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-3 bg-background/80 p-3 backdrop-blur sm:p-4">
          <div className="min-w-0 max-w-[46%] space-y-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-2 text-xs shadow-sm sm:text-sm">
            {scheduledEndAt && remainingMs !== null ? (
              <p className="truncate font-medium text-foreground">
                {remainingMs > 0 ? (
                  <>
                    距离考试结束还剩{' '}
                    <span className="font-mono text-base font-bold tabular-nums text-primary sm:text-lg">
                      {formatExamRemaining(remainingMs)}
                    </span>
                    ，到点将自动交卷。
                  </>
                ) : (
                  <span className="font-semibold text-destructive">
                    考试时间已到，正在自动提交试卷…
                  </span>
                )}
              </p>
            ) : null}
            {saveLabel ? (
              <p className="truncate text-foreground/90">保存状态：{saveLabel}</p>
            ) : null}
            {progressSyncLabel ? (
              <p className="truncate text-foreground/90">同步状态：{progressSyncLabel}</p>
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-x-0 flex justify-center px-20">
            <p className="truncate text-center text-lg font-bold text-foreground sm:text-xl">
              {examTitle ?? '考试中'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLogoutOpen(true)}
          >
            退出登录
          </Button>
        </div>
      ) : null}

      {!loading && answerProgress.totalCount > 0 ? (
        <StudentExamAnswerOverview
          summary={answerProgress}
          contentModules={contentModules}
          readOnly={readOnly}
        />
      ) : null}

      <div
        className={cn(
          'mx-auto w-full space-y-10 p-4 pb-8',
          !readOnly && 'pt-14',
          hasObjectiveModule &&
            answerProgress.totalCount > 0 &&
            'pt-28 sm:pt-32',
          pageMaxWidth,
        )}
      >
      {readOnly ? (
        <Alert>
          <AlertDescription>
            您已提交本场考试，答卷为只读。
            {hasPracticalModule
              ? ' 操作题文件已提交，等待阅卷。'
              : ''}
          </AlertDescription>
        </Alert>
      ) : null}

      {hasObjectiveModule &&
      needsQuestionItems(contentModules) &&
      objectiveItems.length > 0 ? (
        <section className="space-y-6" aria-labelledby="objective-section-title">
          <h2
            id="objective-section-title"
            className="text-lg font-semibold text-foreground"
          >
            客观题
          </h2>
          {objectiveItems.map((item, index) => {
            const submissionItem = item as ExamSubmissionItem;
            const showResult = false;

            return (
              <Card key={item.examQuestionId}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span>{`第 ${index + 1} 题`}</span>
                    <Badge variant="secondary">
                      {questionTypeLabel(item.type)}
                    </Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      {`${item.points} 分`}
                    </span>
                    {showResult ? (
                      <Badge
                        variant={
                          submissionItem.isCorrect ? 'default' : 'outline'
                        }
                      >
                        {submissionItem.isCorrect ? '正确' : '错误'}
                        {`（${submissionItem.pointsAwarded} 分）`}
                      </Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-base text-foreground">
                    {formatStemForDisplay(item.stem)}
                  </p>

                  {item.type === 'MULTI' ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        多选题须选出全部正确选项才得分。
                      </p>
                      <ObjectiveOptionTiles
                        examQuestionId={item.examQuestionId}
                        options={item.options}
                        multiple
                        selectedKeys={answers[item.examQuestionId] ?? ''}
                        readOnly={readOnly}
                        onSelect={(key) => updateAnswer(item.examQuestionId, key)}
                        onToggle={(key, checked) =>
                          toggleMulti(item.examQuestionId, key, checked)
                        }
                      />
                    </div>
                  ) : (
                    <ObjectiveOptionTiles
                      examQuestionId={item.examQuestionId}
                      options={item.options}
                      multiple={false}
                      selectedKeys={answers[item.examQuestionId] ?? ''}
                      readOnly={readOnly}
                      onSelect={(key) => updateAnswer(item.examQuestionId, key)}
                      onToggle={(key, checked) =>
                        toggleMulti(item.examQuestionId, key, checked)
                      }
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : hasObjectiveModule ? (
        <section aria-labelledby="objective-section-title">
          <h2
            id="objective-section-title"
            className="text-lg font-semibold text-foreground"
          >
            客观题
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            本场考试暂无客观题。
          </p>
        </section>
      ) : null}

      {hasFillModule ? (
        <section
          className="space-y-4"
          aria-labelledby="fillin-section-title"
        >
          <h2
            id="fillin-section-title"
            className="text-lg font-semibold text-foreground"
          >
            填空题
          </h2>
          <div className="h-[min(88vh,68rem)] min-h-[18rem]">
            <StudentFillInWorkspace
              examId={examId}
              meta={fillIn}
              items={fillItems}
              answers={answers}
              readOnly={readOnly}
              showResult={false}
              onAnswerChange={updateAnswer}
            />
          </div>
        </section>
      ) : null}

      {hasPracticalModule ? (
        <section
          className="space-y-4"
          aria-labelledby="practical-section-title"
        >
          <h2
            id="practical-section-title"
            className="text-lg font-semibold text-foreground"
          >
            操作题
          </h2>
          {practical ? (
            <StudentPracticalSection
              examId={examId}
              meta={practical}
              readOnly={readOnly}
              submittedFileName={practicalSubmittedName}
              onUploadSuccess={setPractical}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              操作题资料加载中或不可用。
            </p>
          )}
        </section>
      ) : null}

      <div className="border-t border-border pt-6">
        {readOnly ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            size="lg"
            onClick={() => setLogoutOpen(true)}
          >
            退出登录
          </Button>
        ) : (
          <>
            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={submitting || autoSubmitting}
              onClick={() => void tryOpenSubmitDialog()}
            >
              {autoSubmitting ? '正在自动交卷…' : '提交试卷'}
            </Button>
            <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认提交？</AlertDialogTitle>
                  <AlertDialogDescription>
                    {submitConfirmDescription}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>再检查一下</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting
                      ? '交卷处理中，请勿关闭页面…'
                      : submitBlockers.canSubmit
                        ? '确认提交'
                        : '仍要提交'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
      </div>
    </>
  );
}

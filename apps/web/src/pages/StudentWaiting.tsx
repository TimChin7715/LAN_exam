import { Clock, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatExamDateTime } from '@/lib/exam';
import { formatExamRemaining } from '@/lib/exam-countdown';
import {
  ApiError,
  computeEnterExamDelayMs,
  STUDENT_WAITING_POLL_INTERVAL_MS,
  studentApi,
  type StudentProfile,
} from '@/lib/student';

export default function StudentWaiting() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [waitingHint, setWaitingHint] = useState<string | null>(null);
  const [enteringExam, setEnteringExam] = useState(false);
  const [currentExamTitle, setCurrentExamTitle] = useState<string | null>(null);
  const [scheduledStartAt, setScheduledStartAt] = useState<string | null>(null);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);
  const [chooseExams, setChooseExams] = useState<
    Array<{
      id: string;
      title: string;
      scheduledStartAt: string | null;
      scheduledEndAt: string | null;
    }>
  >([]);
  const [selectingExamId, setSelectingExamId] = useState<string | null>(null);
  const navigateScheduledRef = useRef(false);
  const enterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (enterTimeoutRef.current) {
        clearTimeout(enterTimeoutRef.current);
        enterTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await studentApi.me();
        if (!cancelled) setProfile(me);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            navigate('/exam/login', { replace: true });
            return;
          }
          navigate('/exam/login', { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!profile || loading) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const scheduleEnterExam = (examId: string) => {
      if (navigateScheduledRef.current) return;
      navigateScheduledRef.current = true;
      setEnteringExam(true);
      setWaitingHint(null);
      setScheduledStartAt(null);
      setChooseExams([]);

      const delayMs = computeEnterExamDelayMs(profile.nationalId);
      enterTimeoutRef.current = setTimeout(() => {
        navigate(`/exam/take?examId=${encodeURIComponent(examId)}`, {
          replace: true,
        });
      }, delayMs);
    };

    const poll = async () => {
      if (document.hidden || navigateScheduledRef.current) return;
      try {
        const status = await studentApi.examStatus();
        if (status.status === 'choose_exam') {
          setChooseExams(status.exams);
          setCurrentExamTitle(null);
          setScheduledStartAt(null);
          setWaitingHint(
            '当前有多场考试同时进行，请先选择您要参加的考试，开考后将自动进入答题页。',
          );
          setEnteringExam(false);
          return;
        }
        setChooseExams([]);
        setScheduledStartAt(null);
        if (status.status === 'IN_PROGRESS') {
          setCurrentExamTitle(status.title);
          scheduleEnterExam(status.examId);
        } else if (status.status === 'ENDED') {
          setCurrentExamTitle(status.title);
          setScheduledStartAt(null);
          setWaitingHint(null);
          navigate(`/exam/ended?examId=${encodeURIComponent(status.examId)}`, {
            replace: true,
          });
        } else if (status.status === 'waiting') {
          setCurrentExamTitle(status.title);
          setScheduledStartAt(status.scheduledStartAt);
          setWaitingHint(
            `「${status.title}」将于 ${formatExamDateTime(status.scheduledStartAt)} 开始，请稍候。`,
          );
        } else {
          setCurrentExamTitle(null);
          setScheduledStartAt(null);
          setWaitingHint(null);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/exam/login', { replace: true });
        }
      }
    };

    const startPolling = () => {
      if (intervalId !== undefined) return;
      void poll();
      intervalId = setInterval(() => {
        void poll();
      }, STUDENT_WAITING_POLL_INTERVAL_MS);
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
  }, [profile, loading, navigate]);

  useEffect(() => {
    if (!scheduledStartAt) {
      setCountdownMs(null);
      return;
    }
    const targetMs = new Date(scheduledStartAt).getTime();
    const tick = () => {
      setCountdownMs(targetMs - Date.now());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledStartAt]);

  async function handleChooseExam(examId: string) {
    setSelectingExamId(examId);
    try {
      await studentApi.selectExam(examId);
      const status = await studentApi.examStatus();
      if (status.status === 'IN_PROGRESS') {
        if (enterTimeoutRef.current) {
          clearTimeout(enterTimeoutRef.current);
          enterTimeoutRef.current = null;
        }
        navigateScheduledRef.current = false;
        setEnteringExam(false);
        navigate(`/exam/take?examId=${encodeURIComponent(status.examId)}`, {
          replace: true,
        });
        return;
      }
      if (status.status === 'waiting') {
        setChooseExams([]);
        setScheduledStartAt(status.scheduledStartAt);
        setWaitingHint(
          `「${status.title}」将于 ${formatExamDateTime(status.scheduledStartAt)} 开始，请稍候。`,
        );
      }
    } catch (err) {
      setWaitingHint(
        err instanceof ApiError ? err.message : '无法选择考试，请重试。',
      );
    } finally {
      setSelectingExamId(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await studentApi.logout();
    } finally {
      navigate('/exam/login', { replace: true });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-base text-muted-foreground">正在加载…</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle>考试准备</CardTitle>
          <CardDescription>请确认身份信息并等待开考</CardDescription>
          {currentExamTitle ? (
            <p className="text-sm font-medium text-foreground">
              当前考试：{currentExamTitle}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">姓名</dt>
              <dd className="text-base font-medium text-foreground">
                {profile.fullName}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">身份证号</dt>
              <dd className="font-mono text-base text-foreground">
                {profile.nationalId}
              </dd>
            </div>
          </dl>

          {chooseExams.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">选择考试</p>
              <ul className="space-y-2">
                {chooseExams.map((exam) => (
                  <li key={exam.id}>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                      disabled={selectingExamId !== null || enteringExam}
                      onClick={() => void handleChooseExam(exam.id)}
                    >
                      {selectingExamId === exam.id ? (
                        <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                      ) : null}
                      {exam.title}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {enteringExam ? (
            <p className="text-center text-base text-muted-foreground">
              考试已开始，正在为您加载试卷，请稍候…
            </p>
          ) : countdownMs !== null && scheduledStartAt ? (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-6 text-center">
              <div className="flex items-center justify-center gap-2">
                <Clock className="size-5 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  距离考试开始还有
                </p>
              </div>
              <p className="font-mono text-4xl font-bold tabular-nums leading-none text-primary sm:text-5xl">
                {countdownMs > 0
                  ? formatExamRemaining(countdownMs)
                  : '即将开始'}
              </p>
              {currentExamTitle ? (
                <p className="text-sm font-medium text-foreground">
                  {currentExamTitle}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                计划开考时间：{formatExamDateTime(scheduledStartAt)}
              </p>
            </div>
          ) : (
            <p className="text-center text-base text-muted-foreground">
              {waitingHint ??
                '监考教师开始考试后，本页将在开考时间自动进入答题界面。'}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loggingOut || enteringExam}
            onClick={() => void handleLogout()}
          >
            {loggingOut ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : null}
            退出
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

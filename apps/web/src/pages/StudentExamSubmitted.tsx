import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ApiError,
  STUDENT_SUBMITTED_POLL_INTERVAL_MS,
  studentApi,
  type StudentProfile,
} from '@/lib/student';

export default function StudentExamSubmitted() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get('examId') ?? '';

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [examInProgress, setExamInProgress] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!examId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const me = await studentApi.me();
        if (cancelled) return;
        setProfile(me);

        try {
          await studentApi.examSubmission(examId);
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            navigate(`/exam/take?examId=${encodeURIComponent(examId)}`, {
              replace: true,
            });
            return;
          }
          throw err;
        }

        const status = await studentApi.examStatus();
        if (cancelled) return;

        if (status.status === 'ENDED') {
          navigate(`/exam/ended?examId=${encodeURIComponent(status.examId)}`, {
            replace: true,
          });
          return;
        }

        if (status.status === 'IN_PROGRESS' && status.examId === examId) {
          setTitle(status.title);
          setExamInProgress(true);
        } else if (status.status === 'waiting' && status.examId === examId) {
          setTitle(status.title);
          setExamInProgress(false);
        } else {
          setTitle("本场考试");
          setExamInProgress(false);
        }
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.status === 401) {
          navigate('/exam/login', { replace: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      if (document.hidden) return;
      try {
        const status = await studentApi.examStatus();
        if (status.status === 'ENDED') {
          navigate(
            `/exam/ended?examId=${encodeURIComponent(status.examId)}`,
            { replace: true },
          );
        }
      } catch {
        /* ignore */
      }
    };

    const startPolling = () => {
      if (intervalId !== undefined) return;
      intervalId = setInterval(() => {
        void poll();
      }, STUDENT_SUBMITTED_POLL_INTERVAL_MS);
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
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [examId, navigate]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await studentApi.logout();
    } finally {
      navigate('/exam/login', { replace: true });
    }
  }

  if (!examId) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>缺少考试参数，请从准备页重新进入。</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-base text-muted-foreground">正在加载…</p>
      </div>
    );
  }

  const examTitle = title
    ? "「" + title + "」"
    : "本场考试";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-[440px]">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle>提交成功</CardTitle>
          <CardDescription>{examTitle}答卷已提交</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {profile ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">姓名</dt>
                <dd className="text-base font-medium text-foreground">
                  {profile.fullName}
                </dd>
              </div>
            </dl>
          ) : null}

          <Alert>
            <AlertDescription className="space-y-1">
              <p>您已成功交卷，答卷为只读。</p>
              {examInProgress ? (
                <p>考试仍在进行，请留在考场等待监考教师结束考试。</p>
              ) : null}
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                navigate(`/exam/take?examId=${encodeURIComponent(examId)}`)
              }
            >
              查看答卷
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              {loggingOut ? "退出中…" : "退出登录"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

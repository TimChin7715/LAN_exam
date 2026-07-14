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
import { formatExamDateTime } from '@/lib/exam';
import { ApiError, studentApi, type StudentProfile } from '@/lib/student';

export default function StudentExamEnded() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examIdParam = searchParams.get('examId') ?? '';

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [showScoreAfterSubmit, setShowScoreAfterSubmit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await studentApi.me();
        if (cancelled) return;
        setProfile(me);

        const status = await studentApi.examStatus();
        if (cancelled) return;

        if (status.status === 'none') {
          navigate('/exam/waiting', { replace: true });
          return;
        }

        if (status.status === 'ENDED') {
          if (examIdParam && status.examId !== examIdParam) {
            navigate(
              `/exam/ended?examId=${encodeURIComponent(status.examId)}`,
              { replace: true },
            );
            return;
          }
          setTitle(status.title);
          setEndedAt(status.endedAt);
          setSubmitted(status.submitted);
          setTotalScore(status.totalScore);
          setShowScoreAfterSubmit(status.showScoreAfterSubmit);
        } else if (status.status === 'IN_PROGRESS') {
          try {
            await studentApi.examSubmission(status.examId);
            navigate(
              `/exam/submitted?examId=${encodeURIComponent(status.examId)}`,
              { replace: true },
            );
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              navigate(
                `/exam/take?examId=${encodeURIComponent(status.examId)}`,
                { replace: true },
              );
            }
          }
        } else if (examIdParam) {
          setTitle('本场考试');
          setSubmitted(false);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            navigate('/exam/login', { replace: true });
            return;
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examIdParam, navigate]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await studentApi.logout();
    } finally {
      navigate('/exam/login', { replace: true });
    }
  }

  const resolvedExamId = examIdParam;

  if (loading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
        <p className="text-xl text-muted-foreground">正在加载…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full flex-col bg-background px-5 py-8 sm:px-8">
      <Card className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
        <CardHeader className="space-y-3 pb-8">
          <CardTitle>考试已结束</CardTitle>
          <CardDescription className="text-xl">
            {title ? `「${title}」` : '本场考试'}已由监考教师结束
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {profile ? (
            <dl className="space-y-4 text-lg">
              <div>
                <dt className="text-muted-foreground">姓名</dt>
                <dd className="text-2xl font-medium text-foreground">
                  {profile.fullName}
                </dd>
              </div>
            </dl>
          ) : null}

          {endedAt ? (
            <p className="text-lg text-muted-foreground">
              结束时间：{formatExamDateTime(endedAt)}
            </p>
          ) : null}

          {submitted ? (
            <Alert className="text-lg">
              <AlertDescription className="space-y-2 text-lg">
                <p>您已交卷，答卷为只读。</p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="text-lg">
              <AlertDescription className="text-lg">
                您未交卷。考试结束后无法继续作答，未提交的答案不作为成绩。
              </AlertDescription>
            </Alert>
          )}

          {showScoreAfterSubmit && submitted && totalScore !== null ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 text-center">
              <p className="mb-2 text-sm font-medium text-foreground">您的得分</p>
              <p className="font-mono text-4xl font-bold tabular-nums text-primary">
                {totalScore}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            {submitted && resolvedExamId ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 w-full text-lg"
                onClick={() =>
                  navigate(
                    `/exam/take?examId=${encodeURIComponent(resolvedExamId)}`,
                  )
                }
              >
                查看答卷
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="h-12 w-full text-lg"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              {loggingOut ? '退出中…' : '退出登录'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

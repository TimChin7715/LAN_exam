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
import {
  ApiError,
  needsPractical,
  studentApi,
  type ExamContentModule,
  type StudentProfile,
} from '@/lib/student';

export default function StudentExamEnded() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examIdParam = searchParams.get('examId') ?? '';

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [contentModules, setContentModules] = useState<ExamContentModule[]>([
    'OBJECTIVE',
  ]);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
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

        if (status.status === 'ENDED') {
          if (examIdParam && status.examId !== examIdParam) {
            navigate(
              `/exam/ended?examId=${encodeURIComponent(status.examId)}`,
              { replace: true },
            );
            return;
          }
          setTitle(status.title);
          setContentModules(status.contentModules);
          setEndedAt(status.endedAt);
          setSubmitted(status.submitted);
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
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-base text-muted-foreground">正在加载…</p>
      </div>
    );
  }

  const hasPractical = needsPractical(contentModules);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-[440px]">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle>考试已结束</CardTitle>
          <CardDescription>
            {title ? `「${title}」` : '本场考试'}已由监考教师结束
          </CardDescription>
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

          {endedAt ? (
            <p className="text-sm text-muted-foreground">
              结束时间：{formatExamDateTime(endedAt)}
            </p>
          ) : null}

          {submitted ? (
            <Alert>
              <AlertDescription className="space-y-1">
                <p>您已交卷，答卷为只读。</p>
                {hasPractical ? (
                  <p>操作题答卷已提交，将由考官人工评阅。</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>
                您未交卷。考试结束后无法继续作答，未提交的答案不作为成绩。
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            {submitted && resolvedExamId ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
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
              className="w-full"
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

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ApiError, studentApi, type StudentProfile } from '@/lib/student';

export default function StudentWaiting() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

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
          <p className="text-center text-base text-foreground">
            请等待监考教师开始考试
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loggingOut}
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

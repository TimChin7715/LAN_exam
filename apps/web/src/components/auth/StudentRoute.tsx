import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { Spinner } from '@/components/ui/spinner';
import { ApiError, studentApi } from '@/lib/student';

type StudentAuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export function StudentRoute() {
  const location = useLocation();
  const [status, setStatus] = useState<StudentAuthStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await studentApi.me();
        if (!cancelled) setStatus('authenticated');
      } catch (err) {
        if (!cancelled) {
          if (
            err instanceof ApiError &&
            err.status === 401 &&
            location.pathname === '/exam/waiting'
          ) {
            toast.error('登录已过期，请重新验证身份。');
          }
          setStatus('unauthenticated');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (status === 'checking') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
        <Spinner />
        <p className="text-base text-muted-foreground">正在验证考生身份…</p>
      </div>
    );
  }

  if (status === 'unauthenticated' && location.pathname === '/exam/waiting') {
    return <Navigate to="/exam/login" replace />;
  }

  if (status === 'authenticated' && location.pathname === '/exam/login') {
    return <Navigate to="/exam/waiting" replace />;
  }

  return <Outlet />;
}

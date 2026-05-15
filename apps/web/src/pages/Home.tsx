import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { Spinner } from '@/components/ui/spinner';
import { studentApi } from '@/lib/student';

export default function Home() {
  const [target, setTarget] = useState<'login' | 'waiting' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await studentApi.me();
        if (!cancelled) setTarget('waiting');
      } catch {
        if (!cancelled) setTarget('login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (target === null) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
        <Spinner />
      </div>
    );
  }

  return (
    <Navigate to={target === 'waiting' ? '/exam/waiting' : '/exam/login'} replace />
  );
}

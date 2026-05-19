import { Outlet } from 'react-router-dom';

import { isAdminAuthDisabled } from '@/lib/admin-auth';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function AdminLayout() {
  const { user, clearSession } = useAuth();

  async function handleLogout() {
    if (isAdminAuthDisabled) {
      return;
    }
    try {
      await authApi.logout();
    } finally {
      clearSession();
      window.location.href = '/admin/login';
    }
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <span className="text-base font-semibold text-foreground">
          {isAdminAuthDisabled ? '考试管理台' : '局域网考试系统'}
        </span>
        {!isAdminAuthDisabled ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              {user?.username}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
              退出登录
            </Button>
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-[960px] px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

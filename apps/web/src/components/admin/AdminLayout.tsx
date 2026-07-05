import { Settings } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { isAdminAuthDisabled } from '@/lib/admin-auth';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AdminLayout() {
  const { user, clearSession } = useAuth();
  const { pathname } = useLocation();
  const onSettingsPage = pathname === '/admin/settings';

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
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-5 md:px-8">
        <span className="text-lg font-semibold text-foreground sm:text-xl">
          {isAdminAuthDisabled ? '考试管理台' : '局域网考试系统'}
        </span>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            asChild
            className={cn('text-base', onSettingsPage && 'text-primary')}
          >
            <Link
              to="/admin/settings"
              aria-current={onSettingsPage ? 'page' : undefined}
            >
              <Settings aria-hidden />
              设置
            </Link>
          </Button>
          {!isAdminAuthDisabled ? (
            <>
              <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                <span className="size-2 rounded-full bg-primary" aria-hidden />
                {user?.username}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
                退出登录
              </Button>
            </>
          ) : null}
        </div>
      </header>
      <main className="admin-shell mx-auto w-full max-w-[96rem] px-5 py-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}

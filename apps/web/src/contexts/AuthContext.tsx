import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { isAdminAuthDisabled } from '@/lib/admin-auth';
import {
  authApi,
  setPasswordChangeRequiredHandler,
  setSessionExpiredHandler,
  type AuthUser,
} from '@/lib/api';

export type AuthStatus =
  | 'checking'
  | 'unauthenticated'
  | 'mustChangePassword'
  | 'authenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DISABLED_ADMIN_USER: AuthUser = {
  username: 'local_exam_admin',
  displayName: '考试管理台',
  mustChangePassword: false,
};

function statusFromUser(user: AuthUser | null): AuthStatus {
  if (!user) {
    return 'unauthenticated';
  }
  if (user.mustChangePassword) {
    return 'mustChangePassword';
  }
  return 'authenticated';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isAdminAuthDisabled ? 'authenticated' : 'checking',
  );
  const [user, setUserState] = useState<AuthUser | null>(
    isAdminAuthDisabled ? DISABLED_ADMIN_USER : null,
  );

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next);
    setStatus(statusFromUser(next));
  }, []);

  const clearSession = useCallback(() => {
    if (isAdminAuthDisabled) {
      setUserState(DISABLED_ADMIN_USER);
      setStatus('authenticated');
      return;
    }
    setUserState(null);
    setStatus('unauthenticated');
  }, []);

  const hasHydrated = useRef(isAdminAuthDisabled);

  const refresh = useCallback(async () => {
    if (isAdminAuthDisabled) {
      setUser(DISABLED_ADMIN_USER);
      hasHydrated.current = true;
      return;
    }

    if (!hasHydrated.current) {
      setStatus('checking');
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      hasHydrated.current = true;
    }
  }, [setUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (isAdminAuthDisabled) {
      return;
    }

    setSessionExpiredHandler(() => {
      clearSession();
      if (!window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login';
      }
    });
    setPasswordChangeRequiredHandler(() => {
      setUserState((prev) =>
        prev ? { ...prev, mustChangePassword: true } : prev,
      );
      setStatus('mustChangePassword');
      if (window.location.pathname !== '/admin/change-password') {
        window.location.href = '/admin/change-password';
      }
    });
    return () => {
      setSessionExpiredHandler(() => {});
      setPasswordChangeRequiredHandler(() => {});
    };
  }, [clearSession]);

  const value = useMemo(
    () => ({
      status,
      user,
      refresh,
      setUser,
      clearSession,
    }),
    [status, user, refresh, setUser, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

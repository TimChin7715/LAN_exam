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
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUserState] = useState<AuthUser | null>(null);

  const setUser = useCallback((next: AuthUser | null) => {
    setUserState(next);
    setStatus(statusFromUser(next));
  }, []);

  const clearSession = useCallback(() => {
    setUserState(null);
    setStatus('unauthenticated');
  }, []);

  const hasHydrated = useRef(false);

  const refresh = useCallback(async () => {
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

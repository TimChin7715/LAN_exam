import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authApi, setSessionExpiredHandler, type AuthUser } from '@/lib/api';

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

  const refresh = useCallback(async () => {
    setStatus('checking');
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
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
    return () => setSessionExpiredHandler(() => {});
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

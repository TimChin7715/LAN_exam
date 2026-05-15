import { toast } from 'sonner';

export type AuthUser = {
  username: string;
  displayName: string;
  mustChangePassword: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { skipAuthRedirect?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson
    ? ((await response.json()) as Record<string, unknown>)
    : null;

  if (response.status === 401 && !init?.skipAuthRedirect) {
    sessionExpiredHandler?.();
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : '登录已过期，请重新登录。';
    toast.error('登录已过期，请重新登录。');
    throw new ApiError(message, 401);
  }

  if (!response.ok) {
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof payload?.error === 'string'
          ? payload.error
          : '无法连接服务器，请检查网络或联系机房管理员。';
    const code = typeof payload?.code === 'string' ? payload.code : undefined;
    throw new ApiError(message, response.status, code);
  }

  return payload as T;
}

export const authApi = {
  me: () => apiFetch<AuthUser>('/api/auth/me', { skipAuthRedirect: true }),

  login: (username: string, password: string) =>
    apiFetch<AuthUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuthRedirect: true,
    }),

  logout: () =>
    apiFetch<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      skipAuthRedirect: true,
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<AuthUser>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

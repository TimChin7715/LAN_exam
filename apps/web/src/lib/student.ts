import { ApiError, apiFetch } from '@/lib/api';

export type StudentProfile = {
  fullName: string;
  nationalId: string;
};

export const STUDENT_AUTH_ERROR_MESSAGE =
  '姓名或身份证号不正确，请检查后重试。';

export const STUDENT_ID_FORMAT_ERROR_MESSAGE = '身份证号格式不正确';

export const studentApi = {
  verify: (fullName: string, nationalId: string) =>
    apiFetch<{ ok: true }>('/api/student/verify', {
      method: 'POST',
      body: JSON.stringify({ fullName, nationalId }),
      skipAuthRedirect: true,
    }),

  me: () =>
    apiFetch<StudentProfile>('/api/student/me', { skipAuthRedirect: true }),

  logout: () =>
    apiFetch<{ ok: true }>('/api/student/logout', {
      method: 'POST',
      skipAuthRedirect: true,
    }),
};

export { ApiError };

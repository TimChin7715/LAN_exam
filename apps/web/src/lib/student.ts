import { ApiError, apiFetch } from '@/lib/api';

export type StudentProfile = {
  fullName: string;
  nationalId: string;
};

export type StudentExamStatus =
  | { status: 'none' }
  | { status: 'IN_PROGRESS'; examId: string; title: string };

export const STUDENT_AUTH_ERROR_MESSAGE =
  '姓名或身份证号不正确，请检查后重试。';

export const STUDENT_ID_FORMAT_ERROR_MESSAGE = '身份证号格式不正确';

export const STUDENT_ALREADY_SUBMITTED_MESSAGE =
  '您已提交过本场考试，无法再次提交。';

export type ExamPaperItem = {
  examQuestionId: string;
  sortOrder: number;
  type: 'SINGLE' | 'MULTI' | 'JUDGE';
  stem: string;
  points: number;
  options: { key: string; text: string; sortOrder: number }[];
  selectedKeys: string;
};

export type ExamSubmissionItem = ExamPaperItem & {
  isCorrect: boolean;
  pointsAwarded: number;
};

export const studentApi = {
  verify: (fullName: string, nationalId: string) =>
    apiFetch<{ ok: true }>('/api/student/verify', {
      method: 'POST',
      body: JSON.stringify({ fullName, nationalId }),
      skipAuthRedirect: true,
    }),

  me: () =>
    apiFetch<StudentProfile>('/api/student/me', { skipAuthRedirect: true }),

  examStatus: () =>
    apiFetch<StudentExamStatus>('/api/student/exam/status', {
      skipAuthRedirect: true,
    }),

  logout: () =>
    apiFetch<{ ok: true }>('/api/student/logout', {
      method: 'POST',
      skipAuthRedirect: true,
    }),

  examPaper: (examId: string) =>
    apiFetch<{ examId: string; items: ExamPaperItem[] }>(
      `/api/student/exam/paper?examId=${encodeURIComponent(examId)}`,
      { skipAuthRedirect: true },
    ),

  saveAnswers: (examId: string, answers: { examQuestionId: string; selectedKeys: string }[]) =>
    apiFetch<{ ok: true }>('/api/student/exam/answers', {
      method: 'PUT',
      body: JSON.stringify({ examId, answers }),
      skipAuthRedirect: true,
    }),

  submitExam: (examId: string) =>
    apiFetch<{ ok: true; totalScore: number; submittedAt: string }>(
      '/api/student/exam/submit',
      {
        method: 'POST',
        body: JSON.stringify({ examId }),
        skipAuthRedirect: true,
      },
    ),

  examSubmission: (examId: string) =>
    apiFetch<{
      examId: string;
      totalScore: number;
      submittedAt: string;
      items: ExamSubmissionItem[];
    }>(`/api/student/exam/submission?examId=${encodeURIComponent(examId)}`, {
      skipAuthRedirect: true,
    }),
};

export { ApiError };

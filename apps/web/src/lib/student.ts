import { ApiError, apiFetch } from '@/lib/api';

export type StudentProfile = {
  fullName: string;
  nationalId: string;
};

export type ExamContentModule = 'OBJECTIVE' | 'FILL' | 'PRACTICAL';

export function hasExamModule(
  modules: ExamContentModule[],
  module: ExamContentModule,
): boolean {
  return modules.includes(module);
}

export function needsPractical(modules: ExamContentModule[]): boolean {
  return hasExamModule(modules, 'PRACTICAL');
}

export function needsQuestionItems(modules: ExamContentModule[]): boolean {
  return hasExamModule(modules, 'OBJECTIVE') || hasExamModule(modules, 'FILL');
}

export function needsFillIn(modules: ExamContentModule[]): boolean {
  return hasExamModule(modules, 'FILL');
}

export type SeatBoardItem = {
  fullName: string;
  seatLabel: string;
};

export type StudentSeatDisplayStatus = 'not_started' | 'in_progress';

export type StudentSeatBoard = {
  examId: string;
  title: string;
  status: 'DRAFT' | 'IN_PROGRESS';
  displayStatus: StudentSeatDisplayStatus;
  cols: number;
  rows: number;
  items: SeatBoardItem[];
};

export type StudentExamStatus =
  | { status: 'none' }
  | {
      status: 'waiting';
      examId: string;
      title: string;
      scheduledStartAt: string;
    }
  | { status: 'IN_PROGRESS'; examId: string; title: string }
  | {
      status: 'ENDED';
      examId: string;
      title: string;
      contentModules: ExamContentModule[];
      endedAt: string | null;
      submitted: boolean;
      totalScore: number | null;
    };

export const STUDENT_EXAM_ENDED_CODE = 'EXAM_ENDED';

export const STUDENT_WAITING_POLL_INTERVAL_MS = 8000;
export const STUDENT_ACTIVE_EXAM_POLL_INTERVAL_MS = 12000;
export const STUDENT_SUBMITTED_POLL_INTERVAL_MS = 15000;

export const STUDENT_AUTH_ERROR_MESSAGE =
  '姓名或身份证号不正确，请检查后重试。';

export const STUDENT_ID_FORMAT_ERROR_MESSAGE = '身份证号格式不正确';

export const STUDENT_ALREADY_SUBMITTED_MESSAGE =
  '您已提交过本场考试，无法再次提交。';

export type PracticalPaperMeta = {
  batchTitle: string;
  wordFileName: string;
  excelFileName: string;
  hasAnswerDraft: boolean;
  answerFileName: string | null;
  answerUpdatedAt: string | null;
};

export type FillInPaperMeta = {
  batchTitle: string;
  wordFileName: string;
  excelFileName: string;
  attachmentFileName: string | null;
};

export type FillInScreenshotInfo = {
  id: string;
  sortOrder: number;
  previewUrl: string;
};

export type FillInScreenshotsByQuestion = {
  examQuestionId: string;
  screenshots: FillInScreenshotInfo[];
};

export type ExamPaperItem = {
  examQuestionId: string;
  sortOrder: number;
  type: 'SINGLE' | 'MULTI' | 'JUDGE' | 'FILL';
  stem: string;
  points: number;
  /** 填空题：Excel 题号（存于 knowledgePoints） */
  fillQuestionNo?: string | null;
  /** 填空题：同题号内空位序号（存于 explanation） */
  fillBlankIndex?: string | null;
  options: { key: string; text: string; sortOrder: number }[];
  selectedKeys: string;
};

export type ExamSubmissionItem = ExamPaperItem & {
  isCorrect: boolean;
  pointsAwarded: number;
};

const SEAT_BOARD_RETRY_DELAYS_MS = [0, 1000, 2000];

function isRetryableSeatBoardError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof ApiError && err.status >= 500);
}

export async function fetchStudentConfig(): Promise<{ showSeatBoard: boolean }> {
  const data = await apiFetch<{ ok: true; showSeatBoard: boolean }>(
    '/api/student/config',
    { skipAuthRedirect: true },
  );
  return { showSeatBoard: data.showSeatBoard };
}

export async function fetchStudentSeatBoard(): Promise<StudentSeatBoard | null> {
  let lastError: unknown;
  for (let i = 0; i < SEAT_BOARD_RETRY_DELAYS_MS.length; i += 1) {
    const delay = SEAT_BOARD_RETRY_DELAYS_MS[i];
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      const data = await apiFetch<{ ok: true; board: StudentSeatBoard | null }>(
        '/api/student/seat-boards',
        { skipAuthRedirect: true },
      );
      return data.board;
    } catch (err) {
      lastError = err;
      if (!isRetryableSeatBoardError(err) || i === SEAT_BOARD_RETRY_DELAYS_MS.length - 1) {
        throw err;
      }
    }
  }
  throw lastError;
}

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
    apiFetch<{
      examId: string;
      contentModules: ExamContentModule[];
      items: ExamPaperItem[];
      practical: PracticalPaperMeta | null;
      fillIn: FillInPaperMeta | null;
    }>(`/api/student/exam/paper?examId=${encodeURIComponent(examId)}`, {
      skipAuthRedirect: true,
    }),

  saveAnswers: (examId: string, answers: { examQuestionId: string; selectedKeys: string }[]) =>
    apiFetch<{ ok: true }>('/api/student/exam/answers', {
      method: 'PUT',
      body: JSON.stringify({ examId, answers }),
      skipAuthRedirect: true,
    }),

  submitExam: (examId: string) =>
    apiFetch<{ ok: true; totalScore: number | null; submittedAt: string }>(
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
      contentModules: ExamContentModule[];
      totalScore: number | null;
      submittedAt: string;
      items: ExamSubmissionItem[];
      practical: {
        submitted: boolean;
        docxFileName: string;
        submittedAt: string;
      } | null;
    }>(`/api/student/exam/submission?examId=${encodeURIComponent(examId)}`, {
      skipAuthRedirect: true,
    }),

  downloadPracticalPaper: (examId: string) =>
    downloadBlob(
      `/api/student/exam/practical/paper?examId=${encodeURIComponent(examId)}`,
      '试卷.docx',
    ),

  downloadPracticalExcel: (examId: string, fileName: string) =>
    downloadBlob(
      `/api/student/exam/practical/excel?examId=${encodeURIComponent(examId)}`,
      fileName,
    ),

  downloadPracticalAnswer: (examId: string, fileName: string) =>
    downloadBlob(
      `/api/student/exam/practical/answer?examId=${encodeURIComponent(examId)}`,
      fileName,
    ),

  downloadFillInWord: (examId: string, fileName: string) =>
    downloadBlob(
      `/api/student/exam/fillin/word?examId=${encodeURIComponent(examId)}`,
      fileName,
    ),

  fetchFillInWordPreview: (examId: string) =>
    apiFetch<{ ok: true; html: string }>(
      `/api/student/exam/fillin/word/preview?examId=${encodeURIComponent(examId)}`,
      { skipAuthRedirect: true },
    ),

  downloadFillInAttachment: (examId: string, fileName: string) =>
    downloadBlob(
      `/api/student/exam/fillin/attachment?examId=${encodeURIComponent(examId)}`,
      fileName,
    ),

  listFillInScreenshots: (examId: string) =>
    apiFetch<{ ok: true; items: FillInScreenshotsByQuestion[] }>(
      `/api/student/exam/fillin/screenshots?examId=${encodeURIComponent(examId)}`,
      { skipAuthRedirect: true },
    ),

  uploadFillInScreenshot: async (
    examId: string,
    examQuestionId: string,
    file: File,
  ) => {
    const form = new FormData();
    form.append('file', file);
    const url = `/api/student/exam/fillin/screenshots?examId=${encodeURIComponent(examId)}&examQuestionId=${encodeURIComponent(examQuestionId)}`;
    const response = await fetch(url, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const message =
        typeof payload.message === 'string' ? payload.message : '上传失败';
      throw new ApiError(message, response.status);
    }
    return payload as {
      ok: true;
      screenshot: FillInScreenshotInfo;
    };
  },

  deleteFillInScreenshot: (examId: string, screenshotId: string) =>
    apiFetch<{ ok: true }>(
      `/api/student/exam/fillin/screenshots/${encodeURIComponent(screenshotId)}?examId=${encodeURIComponent(examId)}`,
      { method: 'DELETE', skipAuthRedirect: true },
    ),

  uploadPracticalAnswer: async (examId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(
      `/api/student/exam/practical/answer?examId=${encodeURIComponent(examId)}`,
      { method: 'PUT', body: form, credentials: 'include' },
    );
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const message =
        typeof payload.message === 'string' ? payload.message : '上传失败';
      throw new ApiError(message, response.status);
    }
    return payload as {
      ok: true;
      docxFileName: string;
      updatedAt: string;
    };
  },
};

async function downloadBlob(url: string, fallbackName: string): Promise<void> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new ApiError('下载失败', response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export { ApiError };

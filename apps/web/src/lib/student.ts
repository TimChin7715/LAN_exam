import { ApiError, apiFetch } from '@/lib/api';
import { downloadBlobFromUrl, downloadOnce } from '@/lib/download';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { hashString } from '@/lib/hash-string';

export type StudentProfile = {
  fullName: string;
  nationalId: string;
};

export type ExamContentModule = 'OBJECTIVE' | 'FILL';

export function hasExamModule(
  modules: ExamContentModule[],
  module: ExamContentModule,
): boolean {
  return modules.includes(module);
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
      status: 'choose_exam';
      exams: Array<{
        id: string;
        title: string;
        scheduledStartAt: string | null;
        scheduledEndAt: string | null;
      }>;
    }
  | {
      status: 'waiting';
      examId: string;
      title: string;
      scheduledStartAt: string;
    }
  | {
      status: 'IN_PROGRESS';
      examId: string;
      title: string;
      scheduledEndAt: string | null;
    }
  | {
      status: 'DEADLINE_REACHED';
      examId: string;
      title: string;
      scheduledEndAt: string;
    }
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

export const STUDENT_ENTER_EXAM_JITTER_BASE_MS = 8000;
export const STUDENT_ENTER_EXAM_JITTER_RANDOM_MS = 2000;

export const STUDENT_EXAM_SYNC_INTERVAL_MS = 60000;
export const STUDENT_EXAM_SYNC_JITTER_MS = 15000;

export const SERVER_BUSY_CODE = 'SERVER_BUSY';

export function computeEnterExamDelayMs(nationalId: string): number {
  const base = hashString(nationalId) % STUDENT_ENTER_EXAM_JITTER_BASE_MS;
  const extra = Math.floor(Math.random() * STUDENT_ENTER_EXAM_JITTER_RANDOM_MS);
  return base + extra;
}

export function computeExamSyncInitialDelayMs(nationalId: string): number {
  const jitter = hashString(nationalId) % STUDENT_EXAM_SYNC_JITTER_MS;
  return jitter;
}

export type ExamSyncProgressResponse = {
  ok: true;
  syncedAt: string;
  answerCount: number;
  maxDraftUpdatedAt: string | null;
};

export type ExamPaperResponse = {
  examId: string;
  title: string;
  contentModules: ExamContentModule[];
  scheduledEndAt: string | null;
  items: ExamPaperItem[];
  fillIn: FillInPaperMeta | null;
};

export const STUDENT_AUTH_ERROR_MESSAGE =
  '姓名或身份证号不正确，请检查后重试。';

export const STUDENT_ID_FORMAT_ERROR_MESSAGE = '身份证号无效，请检查后重试';

export const STUDENT_ALREADY_SUBMITTED_MESSAGE =
  '您已提交过本场考试，无法再次提交。';

export type FillInPaperMeta = {
  batchTitle: string;
  wordFileName: string;
  excelFileName: string | null;
  hasAttachments: boolean;
  attachmentZipFileName: string | null;
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

export async function fetchStudentSeatBoards(): Promise<StudentSeatBoard[]> {
  let lastError: unknown;
  for (let i = 0; i < SEAT_BOARD_RETRY_DELAYS_MS.length; i += 1) {
    const delay = SEAT_BOARD_RETRY_DELAYS_MS[i];
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      const data = await apiFetch<{
        ok: true;
        board: StudentSeatBoard | null;
        boards: StudentSeatBoard[];
      }>('/api/student/seat-boards', { skipAuthRedirect: true });
      if (data.boards.length > 0) return data.boards;
      return data.board ? [data.board] : [];
    } catch (err) {
      lastError = err;
      if (!isRetryableSeatBoardError(err) || i === SEAT_BOARD_RETRY_DELAYS_MS.length - 1) {
        throw err;
      }
    }
  }
  throw lastError;
}

/** @deprecated use fetchStudentSeatBoards when multiple exams may run concurrently */
export async function fetchStudentSeatBoard(): Promise<StudentSeatBoard | null> {
  const boards = await fetchStudentSeatBoards();
  return boards[0] ?? null;
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

  selectExam: (examId: string) =>
    apiFetch<{
      ok: true;
      examId: string;
      title: string;
      changed: boolean;
    }>('/api/student/exam/select', {
      method: 'POST',
      body: JSON.stringify({ examId }),
      skipAuthRedirect: true,
    }),

  examStatus: () =>
    apiFetch<StudentExamStatus>('/api/student/exam/status', {
      skipAuthRedirect: true,
    }),

  logout: () =>
    apiFetch<{ ok: true }>('/api/student/logout', {
      method: 'POST',
      skipAuthRedirect: true,
    }),

  examPaper: (examId: string, options?: { onRetry?: (attempt: number) => void }) =>
    fetchWithRetry(
      () =>
        apiFetch<ExamPaperResponse>(
          `/api/student/exam/paper?examId=${encodeURIComponent(examId)}`,
          { skipAuthRedirect: true },
        ),
      { onRetry: options?.onRetry },
    ),

  saveAnswers: (examId: string, answers: { examQuestionId: string; selectedKeys: string }[]) =>
    apiFetch<{ ok: true }>('/api/student/exam/answers', {
      method: 'PUT',
      body: JSON.stringify({ examId, answers }),
      skipAuthRedirect: true,
    }),

  syncProgress: (
    examId: string,
    answers: { examQuestionId: string; selectedKeys: string }[],
    options?: { onRetry?: (attempt: number) => void },
  ) =>
    fetchWithRetry(
      () =>
        apiFetch<ExamSyncProgressResponse>('/api/student/exam/sync-progress', {
          method: 'POST',
          body: JSON.stringify({ examId, answers }),
          skipAuthRedirect: true,
        }),
      { onRetry: options?.onRetry },
    ),

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
      title: string;
      contentModules: ExamContentModule[];
      totalScore: number | null;
      submittedAt: string;
      items: ExamSubmissionItem[];
    }>(`/api/student/exam/submission?examId=${encodeURIComponent(examId)}`, {
      skipAuthRedirect: true,
    }),

  fetchFillInWordPreview: async (examId: string, etag?: string) => {
    const url = `/api/student/exam/fillin/word/preview?examId=${encodeURIComponent(examId)}`;
    const headers = new Headers();
    if (etag) {
      headers.set('If-None-Match', `"${etag}"`);
    }
    const response = await fetch(url, {
      credentials: 'include',
      headers,
    });
    if (response.status === 304) {
      return { ok: true as const, notModified: true as const };
    }
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const message =
        typeof payload.message === 'string'
          ? payload.message
          : '无法加载试卷预览';
      throw new ApiError(message, response.status);
    }
    return {
      ok: true as const,
      html: String(payload.html ?? ''),
      version: String(payload.version ?? ''),
    };
  },

  downloadFillInAttachmentsZip: (examId: string, fallbackZipName: string) =>
    downloadBlob(
      `/api/student/exam/fillin/attachment?examId=${encodeURIComponent(examId)}`,
      fallbackZipName,
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
};

async function downloadBlob(url: string, fallbackName: string): Promise<void> {
  return downloadOnce(url, async () => {
    await downloadBlobFromUrl(url, fallbackName, { credentials: 'include' });
  });
}

export { ApiError };

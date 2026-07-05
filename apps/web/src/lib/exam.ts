import { toast } from 'sonner';

import { ApiError, apiFetch, handleAuthResponse } from '@/lib/api';
import { downloadOnce } from '@/lib/download';
import { FILL_MODULE_LABEL } from '@/lib/content-module-labels';

export type ExamStatus = 'DRAFT' | 'IN_PROGRESS' | 'ENDED';
export type ExamContentModule = 'OBJECTIVE' | 'FILL';

export { FILL_MODULE_LABEL };

const MODULE_LABELS: Record<ExamContentModule, string> = {
  OBJECTIVE: '客观题',
  FILL: FILL_MODULE_LABEL,
};

import {
  fetchQuestionBanks,
  type QuestionBankListItem,
} from '@/lib/qbank';
import {
  fetchRosterBatches as listRosterBatches,
  type RosterBatchListItem,
} from '@/lib/roster';

export type BatchPickerItem = QuestionBankListItem;

export type ExamListItem = {
  id: string;
  title: string;
  status: ExamStatus;
  contentModules: ExamContentModule[];
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  questionBatchFileName: string | null;
  fillInBatchTitle: string | null;
  rosterBatchFileName: string;
  questionCount: number;
  submissionCount: number;
};

export type ExamDetail = {
  id: string;
  title: string;
  status: ExamStatus;
  contentModules: ExamContentModule[];
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  questionBatch: { id: string; fileName: string; createdAt: string } | null;
    fillInBatch: {
    id: string;
    title: string;
    wordFileName: string;
    excelFileName: string | null;
    createdAt: string;
  } | null;
  rosterBatch: { id: string; fileName: string; createdAt: string };
  questions: {
    id: string;
    sortOrder: number;
    question: {
      id: string;
      type: 'SINGLE' | 'MULTI' | 'JUDGE' | 'FILL';
      stem: string;
      points: number;
      answerKeys: string;
      options: { key: string; text: string; sortOrder: number }[];
    };
  }[];
  _count: { submissions: number };
};

export type SeatBoardItem = {
  fullName: string;
  seatLabel: string;
};

export type ExamSeatBoard = {
  examId: string;
  title: string;
  status: ExamStatus;
  cols: number;
  rows: number;
  items: SeatBoardItem[];
};

export type SubmissionListItem = {
  rosterEntryId: string;
  fullName: string;
  organization: string;
  nationalId: string;
  totalScore: number | null;
  submitted: boolean;
  statusLabel?: 'submitted' | 'pending' | 'absent';
  submittedAt: string | null;
};

export function examContentModulesLabel(modules: ExamContentModule[]): string {
  if (modules.length === 0) return '—';
  return modules.map((m) => MODULE_LABELS[m] ?? m).join(' + ');
}

export function hasExamModule(
  modules: ExamContentModule[],
  module: ExamContentModule,
): boolean {
  return modules.includes(module);
}

/** Format ISO datetime for display (local timezone). */
export function formatExamDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` input value from ISO string. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Default schedule: start in 30 min (rounded), end +2 hours. */
export function defaultExamSchedule(): { start: string; end: string } {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  start.setMinutes(start.getMinutes() + 30);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return {
    start: toDatetimeLocalValue(start.toISOString()),
    end: toDatetimeLocalValue(end.toISOString()),
  };
}

export function formatExamScheduleRange(
  start: string | null,
  end: string | null,
): string {
  if (!start || !end) return '—';
  return `${formatExamDateTime(start)} — ${formatExamDateTime(end)}`;
}

export function examStatusLabel(status: ExamStatus): string {
  switch (status) {
    case 'DRAFT':
      return '草稿';
    case 'IN_PROGRESS':
      return '进行中';
    case 'ENDED':
      return '已结束';
    default:
      return status;
  }
}

export async function listExams(): Promise<ExamListItem[]> {
  const data = await apiFetch<{ ok: true; items: ExamListItem[] }>('/api/admin/exams');
  return data.items;
}

export async function createExam(input: {
  title: string;
  contentModules: ExamContentModule[];
  questionBatchId?: string;
  fillInBatchId?: string;
  rosterBatchId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
}): Promise<string> {
  const data = await apiFetch<{ ok: true; examId: string }>('/api/admin/exams', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.examId;
}

export async function updateExamSchedule(
  examId: string,
  input: { scheduledStartAt: string; scheduledEndAt: string },
): Promise<void> {
  await apiFetch(`/api/admin/exams/${encodeURIComponent(examId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
    }),
  });
}

export async function getExam(id: string): Promise<ExamDetail> {
  const data = await apiFetch<{ ok: true; exam: ExamDetail }>(
    `/api/admin/exams/${encodeURIComponent(id)}`,
  );
  return data.exam;
}

export async function fetchExamSeats(examId: string): Promise<ExamSeatBoard> {
  const data = await apiFetch<{ ok: true } & ExamSeatBoard>(
    `/api/admin/exams/${encodeURIComponent(examId)}/seats`,
  );
  return {
    examId: data.examId,
    title: data.title,
    status: data.status,
    cols: data.cols,
    rows: data.rows,
    items: data.items,
  };
}

export async function startExam(id: string): Promise<void> {
  await apiFetch(`/api/admin/exams/${encodeURIComponent(id)}/start`, {
    method: 'POST',
  });
}

export async function endExam(id: string): Promise<void> {
  await apiFetch(`/api/admin/exams/${encodeURIComponent(id)}/end`, {
    method: 'POST',
  });
}

export async function fetchQuestionBatches(): Promise<BatchPickerItem[]> {
  return fetchQuestionBanks();
}

export async function fetchRosterBatches(): Promise<RosterBatchListItem[]> {
  return listRosterBatches();
}

export { fetchFillInBatches } from '@/lib/fillin';
export type { FillInBatchListItem } from '@/lib/fillin';

export async function fetchExamSubmissions(
  examId: string,
): Promise<SubmissionListItem[]> {
  const data = await apiFetch<{ ok: true; items: SubmissionListItem[] }>(
    `/api/admin/exams/${encodeURIComponent(examId)}/submissions`,
  );
  return data.items;
}

export async function retakeExamSubmission(
  examId: string,
  rosterEntryId: string,
): Promise<void> {
  await apiFetch<{ ok: true }>(
    `/api/admin/exams/${encodeURIComponent(examId)}/submissions/${encodeURIComponent(rosterEntryId)}/retake`,
    { method: 'POST' },
  );
}

export async function downloadExamExport(examId: string, title: string): Promise<void> {
  const url = `/api/admin/exams/${encodeURIComponent(examId)}/export`;
  await downloadOnce(url, async () => {
    const response = await fetch(url, { credentials: 'include' });

    if (response.status === 401 || response.status === 403) {
      const ct = response.headers.get('content-type') ?? '';
      const payload = ct.includes('application/json')
        ? ((await response.json()) as Record<string, unknown>)
        : null;
      handleAuthResponse(response.status, payload);
      throw new ApiError('Unauthorized', response.status);
    }

    if (!response.ok) {
      toast.error('导出失败，请稍后重试。');
      throw new ApiError('Export failed', response.status);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}-成绩导出.xlsx`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  });
}

export async function downloadFillInScreenshots(
  examId: string,
  title: string,
): Promise<void> {
  const url = `/api/admin/exams/${encodeURIComponent(examId)}/export-fillin-screenshots`;
  await downloadOnce(url, async () => {
    const response = await fetch(url, { credentials: 'include' });

    if (response.status === 401 || response.status === 403) {
      const ct = response.headers.get('content-type') ?? '';
      const payload = ct.includes('application/json')
        ? ((await response.json()) as Record<string, unknown>)
        : null;
      handleAuthResponse(response.status, payload);
      throw new ApiError('Unauthorized', response.status);
    }

    if (!response.ok) {
      const ct = response.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const payload = (await response.json()) as { message?: string };
        toast.error(payload.message ?? `导出${FILL_MODULE_LABEL}截图失败。`);
      } else {
        toast.error(`导出${FILL_MODULE_LABEL}截图失败。`);
      }
      throw new ApiError('Export failed', response.status);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}-${FILL_MODULE_LABEL}截图.zip`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  });
}

export function handleExamApiError(err: unknown, fallback: string): void {
  if (err instanceof ApiError) {
    toast.error(err.message || fallback);
    return;
  }
  toast.error(fallback);
}

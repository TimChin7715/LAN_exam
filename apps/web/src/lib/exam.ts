import { toast } from 'sonner';

import { ApiError, apiFetch, handleAuthResponse } from '@/lib/api';

export type ExamStatus = 'DRAFT' | 'IN_PROGRESS' | 'ENDED';
export type ExamContentModule = 'OBJECTIVE' | 'FILL' | 'PRACTICAL';

const MODULE_LABELS: Record<ExamContentModule, string> = {
  OBJECTIVE: '客观题',
  FILL: '填空题',
  PRACTICAL: '操作题',
};

import {
  fetchQuestionBanks,
  type QuestionBankListItem,
} from '@/lib/qbank';
import {
  fetchPracticalBatches,
  type PracticalBatchListItem,
} from '@/lib/practical';
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
  practicalBatchTitle: string | null;
  rosterBatchFileName: string;
  questionCount: number;
  submissionCount: number;
  practicalSubmissionCount: number;
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
    excelFileName: string;
    createdAt: string;
  } | null;
  practicalBatch: {
    id: string;
    title: string;
    wordFileName: string;
    excelFileName: string;
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
  _count: { submissions: number; practicalSubmissions: number };
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
  submittedAt: string | null;
  practicalSubmitted: boolean;
  practicalSubmittedAt: string | null;
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
  practicalBatchId?: string;
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

export { fetchPracticalBatches };
export type { PracticalBatchListItem };

export { fetchFillInBatches } from '@/lib/fillin';
export type { FillInBatchListItem } from '@/lib/fillin';

export async function downloadPracticalAnswer(
  examId: string,
  rosterEntryId: string,
  fileNameHint: string,
): Promise<void> {
  const response = await fetch(
    `/api/admin/exams/${encodeURIComponent(examId)}/submissions/${encodeURIComponent(rosterEntryId)}/practical-answer`,
    { credentials: 'include' },
  );

  if (!response.ok) {
    toast.error('下载操作题答卷失败。');
    throw new ApiError('Download failed', response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileNameHint.endsWith('.docx')
    ? fileNameHint
    : `${fileNameHint}-操作题作答.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

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
  const response = await fetch(
    `/api/admin/exams/${encodeURIComponent(examId)}/export`,
    { credentials: 'include' },
  );

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
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}-成绩导出.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadFillInScreenshots(
  examId: string,
  title: string,
): Promise<void> {
  const response = await fetch(
    `/api/admin/exams/${encodeURIComponent(examId)}/export-fillin-screenshots`,
    { credentials: 'include' },
  );

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
      toast.error(payload.message ?? '导出填空题截图失败。');
    } else {
      toast.error('导出填空题截图失败。');
    }
    throw new ApiError('Export failed', response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}-填空题截图.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function handleExamApiError(err: unknown, fallback: string): void {
  if (err instanceof ApiError) {
    toast.error(err.message || fallback);
    return;
  }
  toast.error(fallback);
}

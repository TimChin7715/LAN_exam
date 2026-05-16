import { toast } from 'sonner';

import { ApiError, apiFetch } from '@/lib/api';

export type ExamStatus = 'DRAFT' | 'IN_PROGRESS' | 'ENDED';

export type BatchPickerItem = {
  id: string;
  fileName: string;
  createdAt: string;
  itemCount: number;
};

export type ExamListItem = {
  id: string;
  title: string;
  status: ExamStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  questionBatchFileName: string;
  rosterBatchFileName: string;
  questionCount: number;
  submissionCount: number;
};

export type ExamDetail = {
  id: string;
  title: string;
  status: ExamStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  questionBatch: { id: string; fileName: string; createdAt: string };
  rosterBatch: { id: string; fileName: string; createdAt: string };
  questions: {
    id: string;
    sortOrder: number;
    question: {
      id: string;
      type: 'SINGLE' | 'MULTI' | 'JUDGE';
      stem: string;
      points: number;
      answerKeys: string;
      options: { key: string; text: string; sortOrder: number }[];
    };
  }[];
  _count: { submissions: number };
};

export type SubmissionListItem = {
  rosterEntryId: string;
  fullName: string;
  nationalId: string;
  totalScore: number | null;
  submitted: boolean;
  submittedAt: string | null;
};

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
  questionBatchId: string;
  rosterBatchId: string;
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
  const data = await apiFetch<{ ok: true; items: BatchPickerItem[] }>(
    '/api/admin/question-batches',
  );
  return data.items;
}

export async function fetchRosterBatches(): Promise<BatchPickerItem[]> {
  const data = await apiFetch<{ ok: true; items: BatchPickerItem[] }>(
    '/api/admin/roster-batches',
  );
  return data.items;
}

export async function fetchExamSubmissions(
  examId: string,
): Promise<SubmissionListItem[]> {
  const data = await apiFetch<{ ok: true; items: SubmissionListItem[] }>(
    `/api/admin/exams/${encodeURIComponent(examId)}/submissions`,
  );
  return data.items;
}

export function handleExamApiError(err: unknown, fallback: string): void {
  if (err instanceof ApiError) {
    toast.error(err.message || fallback);
    return;
  }
  toast.error(fallback);
}

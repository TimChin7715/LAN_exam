import { toast } from 'sonner';

import { ApiError, apiFetch, handleAuthResponse } from '@/lib/api';

export type QuestionType = 'SINGLE' | 'MULTI' | 'JUDGE' | 'FILL';

export type QuestionBankListItem = {
  id: string;
  fileName: string;
  createdAt: string;
  itemCount: number;
};

export type QuestionBankDetail = QuestionBankListItem & {
  importedCount: number;
  skippedCount: number;
  totalRows: number;
};

export class QuestionBankInUseError extends Error {
  constructor(
    public examTitles: string[],
    message?: string,
  ) {
    const titles = examTitles;
    const hint =
      titles.length > 0
        ? `已被考试「${titles.join('」「')}」使用`
        : '已被考试使用';
    super(message ?? `无法删除：该题库${hint}。`);
    this.name = 'QuestionBankInUseError';
  }
}

export type ImportRowError = {
  row: number;
  column?: string;
  message: string;
};

export type PreviewOption = {
  key: string;
  text: string;
};

export type PreviewQuestion = {
  type: QuestionType;
  stem: string;
  answerKeys: string;
  points: number;
  options?: PreviewOption[];
};

export type ImportSuccess = {
  ok: true;
  batchId: string;
  importedCount: number;
  skippedCount: number;
  previewQuestions: PreviewQuestion[];
  fileName?: string;
};

export type ImportFailure = {
  ok: false;
  errors: ImportRowError[];
};

export type QuestionListItem = {
  id: string;
  type: QuestionType;
  stem: string;
  answerKeys: string;
  points: number;
  difficulty: number;
  batchId: string;
  createdAt: string;
};

export type QuestionDetail = QuestionListItem & {
  explanation: string | null;
  knowledgePoints: string | null;
  multiScoringRule: 'ALL_OR_NOTHING' | null;
  options: Array<{ key: string; text: string; sortOrder: number }>;
};

const TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE: '单选',
  MULTI: '多选',
  JUDGE: '判断',
  FILL: '填空',
};

export function questionTypeLabel(type: QuestionType): string {
  return TYPE_LABELS[type];
}

export function formatAnswerKeys(answerKeys: string): string {
  return answerKeys
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .join('、');
}

/** 展示用题干：去掉导入/测试数据中误写入的内部枚举标记 */
export function formatStemForDisplay(stem: string): string {
  return stem
    .trim()
    .replace(/[（(]\s*ALL_OR_NOTHING\s*[）)]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function truncateStem(stem: string, max = 60): string {
  const trimmed = formatStemForDisplay(stem);
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export async function downloadQuestionTemplate(): Promise<void> {
  const response = await fetch('/api/admin/questions/template', {
    credentials: 'include',
  });

  if (response.status === 401 || response.status === 403) {
    const ct = response.headers.get('content-type') ?? '';
    const payload = ct.includes('application/json')
      ? ((await response.json()) as Record<string, unknown>)
      : null;
    handleAuthResponse(response.status, payload);
    throw new ApiError('Unauthorized', response.status);
  }

  if (!response.ok) {
    toast.error('无法连接服务器，请检查网络或联系机房管理员。');
    throw new ApiError('Template download failed', response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '题库导入模板.xlsx';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importQuestionsFile(
  file: File,
): Promise<ImportSuccess | ImportFailure> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch('/api/admin/questions/import', {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (response.status === 401 || response.status === 403) {
    handleAuthResponse(response.status, payload);
    throw new ApiError('Unauthorized', response.status);
  }

  if (
    response.status === 400 &&
    Array.isArray(payload.errors) &&
    payload.errors.length > 0
  ) {
    return {
      ok: false,
      errors: payload.errors as ImportRowError[],
    };
  }

  if (!response.ok) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : '无法连接服务器，请检查网络或联系机房管理员。';
    throw new ApiError(message, response.status);
  }

  return {
    ok: true,
    batchId: String(payload.batchId),
    importedCount: Number(payload.importedCount),
    skippedCount: Number(payload.skippedCount),
    previewQuestions: (payload.previewQuestions ?? []) as PreviewQuestion[],
    fileName: file.name,
  };
}

export async function fetchQuestionBanks(): Promise<QuestionBankListItem[]> {
  const data = await apiFetch<{ ok: true; items: QuestionBankListItem[] }>(
    '/api/admin/question-batches',
  );
  return data.items;
}

export async function fetchQuestionBank(id: string): Promise<QuestionBankDetail> {
  const data = await apiFetch<{ ok: true; batch: QuestionBankDetail }>(
    `/api/admin/question-batches/${encodeURIComponent(id)}`,
  );
  return data.batch;
}

export async function deleteQuestionBank(id: string): Promise<void> {
  const response = await fetch(
    `/api/admin/question-batches/${encodeURIComponent(id)}`,
    { method: 'DELETE', credentials: 'include' },
  );

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as Record<string, unknown>)
    : null;

  if (response.status === 401 || response.status === 403) {
    handleAuthResponse(response.status, payload);
    throw new ApiError('Unauthorized', response.status);
  }

  if (
    response.status === 409 &&
    payload?.code === 'BATCH_IN_USE'
  ) {
    const titles = Array.isArray(payload.examTitles)
      ? (payload.examTitles as string[])
      : [];
    throw new QuestionBankInUseError(
      titles,
      typeof payload.message === 'string' ? payload.message : undefined,
    );
  }

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : '无法删除题库，请稍后重试。';
    throw new ApiError(message, response.status);
  }
}

export async function fetchQuestions(params: {
  page: number;
  pageSize?: number;
  type?: QuestionType;
  batchId?: string;
}): Promise<{
  items: QuestionListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.type) search.set('type', params.type);
  if (params.batchId) search.set('batchId', params.batchId);

  const data = await apiFetch<{
    ok: boolean;
    items: QuestionListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/admin/questions?${search.toString()}`);

  return {
    items: data.items,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function fetchQuestionDetail(id: string): Promise<QuestionDetail> {
  const data = await apiFetch<{ ok: boolean; question: QuestionDetail }>(
    `/api/admin/questions/${id}`,
  );
  return data.question;
}

export { validateSpreadsheetFile as validateXlsxFile } from '@/lib/upload-formats';

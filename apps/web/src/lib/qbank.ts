import { toast } from 'sonner';

import { ApiError, apiFetch } from '@/lib/api';

export type QuestionType = 'SINGLE' | 'MULTI' | 'JUDGE';

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

export function truncateStem(stem: string, max = 60): string {
  const trimmed = stem.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export async function downloadQuestionTemplate(): Promise<void> {
  const response = await fetch('/api/admin/questions/template', {
    credentials: 'include',
  });

  if (response.status === 401) {
    toast.error('登录已过期，请重新登录。');
    throw new ApiError('Unauthorized', 401);
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

  if (response.status === 401) {
    toast.error('登录已过期，请重新登录。');
    throw new ApiError('Unauthorized', 401);
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

export function validateXlsxFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.xlsx')) {
    return '请选择 .xlsx 格式的 Excel 文件。';
  }
  if (file.size > 5_242_880) {
    return '文件超过 5MB，请拆分或减少题目后重试。';
  }
  return null;
}

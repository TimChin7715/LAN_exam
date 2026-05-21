import { toast } from 'sonner';

import { ApiError, apiFetch, handleAuthResponse } from '@/lib/api';
import type { ImportRowError } from '@/lib/qbank';

export type FillInBatchListItem = {
  id: string;
  title: string;
  wordFileName: string;
  excelFileName: string;
  itemCount: number;
  createdAt: string;
};

export type FillInImportSuccess = {
  ok: true;
  batchId: string;
  title: string;
  importedCount: number;
  wordFileName: string;
  excelFileName: string;
  attachmentFileName: string | null;
};

export type FillInImportFailure = {
  ok: false;
  code: string;
  message: string;
  errors: ImportRowError[];
};

export class FillInBatchInUseError extends Error {
  constructor(
    public examTitles: string[],
    message = '进行中的考试仍引用该批次，请先结束考试后再删除',
  ) {
    super(message);
    this.name = 'FillInBatchInUseError';
  }
}

export {
  validateAnswerSheetFile as validateFillInExcelFile,
  validateSpreadsheetFile as validateFillInAttachmentFile,
  validateWordFile as validateDocxFile,
} from '@/lib/upload-formats';

export async function downloadFillInTemplate(): Promise<void> {
  const response = await fetch('/api/admin/fill-in-batches/template', {
    credentials: 'include',
  });
  if (!response.ok) {
    toast.error('下载模板失败');
    throw new ApiError('Template download failed', response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '填空题导入模板.xlsx';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importFillInBatch(
  wordFile: File,
  excelFile: File,
  attachmentFile?: File | null,
): Promise<FillInImportSuccess | FillInImportFailure> {
  const form = new FormData();
  form.append('wordFile', wordFile);
  form.append('excelFile', excelFile);
  if (attachmentFile) {
    form.append('attachmentFile', attachmentFile);
  }

  const response = await fetch('/api/admin/fill-in-batches/import', {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as Record<string, unknown>)
    : null;

  if (response.status === 401 || response.status === 403) {
    handleAuthResponse(response.status, payload);
    throw new ApiError('Unauthorized', response.status);
  }

  if (!response.ok) {
    if (
      response.status === 400 &&
      payload &&
      Array.isArray(payload.errors)
    ) {
      return {
        ok: false,
        code: String(payload.code ?? 'VALIDATION_ERROR'),
        message: String(payload.message ?? '导入校验未通过'),
        errors: payload.errors as ImportRowError[],
      };
    }
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : '导入失败，请稍后重试。';
    toast.error(message);
    throw new ApiError(message, response.status);
  }

  return payload as unknown as FillInImportSuccess;
}

export async function fetchFillInBatches(): Promise<FillInBatchListItem[]> {
  const data = await apiFetch<{ ok: true; items: FillInBatchListItem[] }>(
    '/api/admin/fill-in-batches',
  );
  return data.items;
}

export async function deleteFillInBatch(id: string): Promise<void> {
  const response = await fetch(
    `/api/admin/fill-in-batches/${encodeURIComponent(id)}`,
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

  if (response.status === 409 && payload && Array.isArray(payload.examTitles)) {
    throw new FillInBatchInUseError(
      payload.examTitles as string[],
      typeof payload.message === 'string' ? payload.message : undefined,
    );
  }

  if (!response.ok) {
    const message =
      typeof payload?.message === 'string' ? payload.message : '删除失败';
    toast.error(message);
    throw new ApiError(message, response.status);
  }
}

export type FillInBlankSpec = { blankIndex: number; answers: string[] };

/** 导入时题号存于 knowledgePoints */
export function parseFillQuestionNo(meta: string | null | undefined): string | null {
  const t = meta?.trim();
  return t || null;
}

/** 学员作答展示：新格式纯文本；旧格式 JSON 合并为可读文本 */
export function displayFillAnswer(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return raw;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') return raw;
    return Object.entries(parsed)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, v]) => v)
      .filter(Boolean)
      .join('；');
  } catch {
    return raw;
  }
}

/** 管理端预览：新格式为 答案|别名；旧格式为 JSON 多空 */
export function parseFillBlankSpecs(answerKeys: string): FillInBlankSpec[] {
  const trimmed = answerKeys.trim();
  if (!trimmed.startsWith('[')) {
    const answers = trimmed
      .split(/[|｜]/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (answers.length === 0) return [];
    return [{ blankIndex: 1, answers }];
  }
  try {
    const parsed = JSON.parse(answerKeys) as FillInBlankSpec[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatFillAnswerKeysPreview(answerKeys: string): string {
  const specs = parseFillBlankSpecs(answerKeys);
  if (specs.length === 0) return '—';
  return specs
    .map((b) =>
      specs.length > 1
        ? `空 ${b.blankIndex}：${b.answers.join(' / ')}`
        : b.answers.join(' / '),
    )
    .join('；');
}

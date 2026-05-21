import { toast } from 'sonner';

import { ApiError, apiFetch, handleAuthResponse } from '@/lib/api';

export type PracticalBatchListItem = {
  id: string;
  title: string;
  wordFileName: string;
  excelFileName: string;
  createdAt: string;
};

export type PracticalImportSuccess = {
  ok: true;
  batchId: string;
  title: string;
  wordFileName: string;
  excelFileName: string;
};

export class PracticalBatchInUseError extends Error {
  constructor(
    public examTitles: string[],
    message = '进行中的考试仍引用该批次，请先结束考试后再删除',
  ) {
    super(message);
    this.name = 'PracticalBatchInUseError';
  }
}

import {
  validateSpreadsheetFile,
  validateWordFile,
} from '@/lib/upload-formats';

export const validatePracticalSpreadsheetFile = validateSpreadsheetFile;
export const validateDocxFile = validateWordFile;

/** @deprecated use validatePracticalSpreadsheetFile */
export function validatePracticalXlsxFile(file: File): string | null {
  return validateSpreadsheetFile(file);
}

export async function importPracticalBatch(
  wordFile: File,
  excelFile: File,
): Promise<PracticalImportSuccess> {
  const form = new FormData();
  form.append('wordFile', wordFile);
  form.append('excelFile', excelFile);

  const response = await fetch('/api/admin/practical-batches/import', {
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
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : '导入失败，请稍后重试。';
    toast.error(message);
    throw new ApiError(message, response.status);
  }

  return payload as unknown as PracticalImportSuccess;
}

export async function fetchPracticalBatches(): Promise<PracticalBatchListItem[]> {
  const data = await apiFetch<{ ok: true; items: PracticalBatchListItem[] }>(
    '/api/admin/practical-batches',
  );
  return data.items;
}

export async function deletePracticalBatch(id: string): Promise<void> {
  const response = await fetch(
    `/api/admin/practical-batches/${encodeURIComponent(id)}`,
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

  if (response.status === 409 && payload?.code === 'BATCH_IN_USE') {
    const titles = Array.isArray(payload.examTitles)
      ? (payload.examTitles as string[])
      : [];
    throw new PracticalBatchInUseError(
      titles,
      typeof payload.message === 'string' ? payload.message : undefined,
    );
  }

  if (!response.ok) {
    throw new ApiError('无法删除操作题批次', response.status);
  }
}

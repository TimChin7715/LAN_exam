import { toast } from 'sonner';

import { ApiError, apiFetch, handleAuthResponse } from '@/lib/api';

export type RosterBatchListItem = {
  id: string;
  fileName: string;
  createdAt: string;
  itemCount: number;
};

export type RosterBatchDetail = RosterBatchListItem & {
  importedCount: number;
  skippedCount: number;
  totalRows: number;
};

export class RosterBatchInUseError extends Error {
  constructor(public examTitles: string[]) {
    super('BATCH_IN_USE');
    this.name = 'RosterBatchInUseError';
  }
}

export type ImportRowError = {
  row: number;
  column?: string;
  message: string;
};

export type ImportSuccess = {
  ok: true;
  batchId: string;
  importedCount: number;
  skippedCount: number;
  fileName?: string;
};

export type ImportFailure = {
  ok: false;
  errors: ImportRowError[];
};

export type RosterListItem = {
  id: string;
  fullName: string;
  nationalId: string;
  createdAt: string;
};

export function maskNationalId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length !== 18) return '—';
  return `${trimmed.slice(0, 6)}********${trimmed.slice(-4)}`;
}

export async function downloadRosterTemplate(): Promise<void> {
  const response = await fetch('/api/admin/roster/template', {
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
  anchor.download = '名单导入模板.xlsx';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importRosterFile(
  file: File,
): Promise<ImportSuccess | ImportFailure> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch('/api/admin/roster/import', {
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
    fileName: file.name,
  };
}

export async function fetchRosterBatches(): Promise<RosterBatchListItem[]> {
  const data = await apiFetch<{ ok: true; items: RosterBatchListItem[] }>(
    '/api/admin/roster-batches',
  );
  return data.items;
}

export async function fetchRosterBatch(id: string): Promise<RosterBatchDetail> {
  const data = await apiFetch<{ ok: true; batch: RosterBatchDetail }>(
    `/api/admin/roster-batches/${encodeURIComponent(id)}`,
  );
  return data.batch;
}

export async function deleteRosterBatch(id: string): Promise<void> {
  const response = await fetch(
    `/api/admin/roster-batches/${encodeURIComponent(id)}`,
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
    throw new RosterBatchInUseError(titles);
  }

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : '无法删除名单，请稍后重试。';
    throw new ApiError(message, response.status);
  }
}

export async function fetchRosterList(params: {
  page: number;
  pageSize?: number;
  query?: string;
  batchId?: string;
}): Promise<{
  items: RosterListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? 20),
  });
  const q = params.query?.trim();
  if (q) search.set('query', q);
  if (params.batchId) search.set('batchId', params.batchId);

  const data = await apiFetch<{
    ok: boolean;
    items: RosterListItem[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/admin/roster?${search.toString()}`);

  return {
    items: data.items,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export function validateXlsxFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.xlsx')) {
    return '请选择 .xlsx 格式的 Excel 文件。';
  }
  return null;
}

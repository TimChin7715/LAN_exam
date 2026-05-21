import { apiFetch } from '@/lib/api';

export const CLEAR_ALL_DATA_CONFIRM_PHRASE = '清除全部数据';

export type AdminSettings = {
  showSeatBoard: boolean;
};

export type ClearAllDataResult = {
  exams: number;
  questionBatches: number;
  rosterBatches: number;
  fillInBatches: number;
  practicalBatches: number;
};

export async function fetchAdminSettings(): Promise<AdminSettings> {
  const data = await apiFetch<{ ok: true; showSeatBoard: boolean }>(
    '/api/admin/settings',
  );
  return { showSeatBoard: data.showSeatBoard };
}

export async function updateAdminSettings(
  settings: AdminSettings,
): Promise<AdminSettings> {
  const data = await apiFetch<{ ok: true; showSeatBoard: boolean }>(
    '/api/admin/settings',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    },
  );
  return { showSeatBoard: data.showSeatBoard };
}

export async function clearAllAdminData(): Promise<ClearAllDataResult> {
  const data = await apiFetch<{
    ok: true;
    deleted: ClearAllDataResult;
  }>('/api/admin/settings/clear-all-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmPhrase: CLEAR_ALL_DATA_CONFIRM_PHRASE }),
  });
  return data.deleted;
}

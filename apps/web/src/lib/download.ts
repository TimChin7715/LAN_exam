import { ApiError } from '@/lib/api';

const inFlight = new Map<string, Promise<void>>();

export async function downloadOnce(
  key: string,
  task: () => Promise<void>,
): Promise<void> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = task().finally(() => {
    if (inFlight.get(key) === p) inFlight.delete(key);
  });
  inFlight.set(key, p);
  return p;
}

export async function downloadBlobFromUrl(
  url: string,
  fallbackName: string,
  options?: RequestInit,
): Promise<void> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new ApiError('下载失败', response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}


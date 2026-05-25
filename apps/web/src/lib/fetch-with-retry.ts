import { ApiError } from '@/lib/api';

const SERVER_BUSY_CODE = 'SERVER_BUSY';

export const DEFAULT_FETCH_RETRY_DELAYS_MS = [0, 1000, 2000, 4000] as const;

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError) {
    return true;
  }
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      return true;
    }
    if (err.status === 503 && err.code === SERVER_BUSY_CODE) {
      return true;
    }
  }
  return false;
}

function delayMsForAttempt(
  err: unknown,
  defaultDelayMs: number,
): number {
  if (err instanceof ApiError && err.retryAfterSec !== undefined) {
    const sec = err.retryAfterSec;
    if (Number.isFinite(sec) && sec > 0) {
      return sec * 1000;
    }
  }
  return defaultDelayMs;
}

export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options?: {
    delaysMs?: readonly number[];
    onRetry?: (attempt: number) => void;
  },
): Promise<T> {
  const delays = options?.delaysMs ?? DEFAULT_FETCH_RETRY_DELAYS_MS;
  let lastError: unknown;

  for (let i = 0; i < delays.length; i += 1) {
    const waitMs =
      i === 0 ? delays[0] : delayMsForAttempt(lastError, delays[i] ?? delays[delays.length - 1]!);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || i === delays.length - 1) {
        throw err;
      }
      options?.onRetry?.(i + 1);
    }
  }

  throw lastError;
}

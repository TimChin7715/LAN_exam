function parsePort(raw: string | undefined, fallback: string, label: string): number {
  const value = raw ?? fallback;
  const port = Number(value);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return port;
}

/** Canonical API listen port — matches `.env` `API_PORT` and Vite proxy. */
export function getApiPort(): number {
  return parsePort(process.env.API_PORT ?? process.env.PORT, '3101', 'API port');
}

export function getWebPort(): number {
  return parsePort(process.env.WEB_PORT, '5180', 'WEB port');
}

export function getListenHost(): string {
  return process.env.LISTEN_HOST ?? process.env.HOST ?? '0.0.0.0';
}

/** Production / native install: single process serves API + SPA on WEB_PORT. */
export function shouldServeWeb(): boolean {
  if (process.env.SERVE_WEB === 'true') {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}

export function getListenPort(): number {
  return shouldServeWeb() ? getWebPort() : getApiPort();
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return n;
}

function parseNonNegativeInt(
  raw: string | undefined,
  fallback: number,
  label: string,
): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return n;
}

export function getExamPaperMaxConcurrent(): number {
  return parsePositiveInt(
    process.env.EXAM_PAPER_MAX_CONCURRENT,
    16,
    'EXAM_PAPER_MAX_CONCURRENT',
  );
}

export function getExamSubmitMaxConcurrent(): number {
  return parsePositiveInt(
    process.env.EXAM_SUBMIT_MAX_CONCURRENT,
    4,
    'EXAM_SUBMIT_MAX_CONCURRENT',
  );
}

export function getExamSubmitMaxQueue(): number {
  return parseNonNegativeInt(
    process.env.EXAM_SUBMIT_MAX_QUEUE,
    128,
    'EXAM_SUBMIT_MAX_QUEUE',
  );
}

export function getExamSyncMaxConcurrent(): number {
  return parsePositiveInt(
    process.env.EXAM_SYNC_MAX_CONCURRENT,
    8,
    'EXAM_SYNC_MAX_CONCURRENT',
  );
}

export function getExamSyncMaxQueue(): number {
  return parseNonNegativeInt(
    process.env.EXAM_SYNC_MAX_QUEUE,
    256,
    'EXAM_SYNC_MAX_QUEUE',
  );
}

export function getSessionPgPoolMax(): number {
  return parsePositiveInt(
    process.env.SESSION_PG_POOL_MAX,
    10,
    'SESSION_PG_POOL_MAX',
  );
}

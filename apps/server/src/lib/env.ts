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

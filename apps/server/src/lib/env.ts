/** Canonical API listen port — matches `.env` `API_PORT` and Vite proxy. */
export function getApiPort(): number {
  const raw = process.env.API_PORT ?? process.env.PORT ?? '3101';
  const port = Number(raw);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid API port: ${raw}`);
  }
  return port;
}

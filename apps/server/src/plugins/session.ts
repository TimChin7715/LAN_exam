import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Pool } from 'pg';

const PgSession = connectPgSimple(session);

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set (min 16 chars) in production');
  }
  return 'dev-only-session-secret-change-me';
}

export function sessionCookieSecure(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.TRUST_PROXY === 'true'
  );
}

export function sessionMaxAgeMs(): number {
  const raw = process.env.SESSION_MAX_AGE_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 24 * 60 * 60 * 1000;
}

export const sessionPlugin = fp(async (app: FastifyInstance) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for session store');
  }

  const cookie = await import('@fastify/cookie');
  const express = await import('@fastify/express');
  await app.register(cookie.default);
  await app.register(express.default);

  const pool = new Pool({ connectionString: databaseUrl });

  app.addHook('onClose', async () => {
    await pool.end();
  });

  const store = new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  });

  const secret = sessionSecret();
  const maxAge = sessionMaxAgeMs();
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: sessionCookieSecure(),
    maxAge,
  };

  const sessionMw = session({
    secret,
    store,
    name: 'sid',
    resave: false,
    saveUninitialized: false,
    cookie: cookieOptions,
  });

  app.use(sessionMw as never);
});

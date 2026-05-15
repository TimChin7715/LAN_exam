import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Pool } from 'pg';

const PgSession = connectPgSimple(session);

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set (min 16 chars) in production');
  }
  return 'dev-only-session-secret-change-me';
}

function cookieSecure(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.TRUST_PROXY === 'true'
  );
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

  app.use(
    session({
      name: 'sid',
      secret: sessionSecret(),
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure(),
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );
});

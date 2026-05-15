import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import type { FastifyInstance } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'http';
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

function sessionMaxAgeMs(): number {
  const raw = process.env.SESSION_MAX_AGE_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 24 * 60 * 60 * 1000;
}

function dualSession(
  teacherMw: ReturnType<typeof session>,
  studentMw: ReturnType<typeof session>,
) {
  return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    // fastify-express bridges IncomingMessage; express-session types expect Express Request
    const expressReq = req as Parameters<typeof teacherMw>[0];
    const expressRes = res as Parameters<typeof teacherMw>[1];
    teacherMw(expressReq, expressRes, (err) => {
      if (err) {
        next(err);
        return;
      }
      const teacherSession = req.session;
      studentMw(expressReq, expressRes, (err2) => {
        if (err2) {
          next(err2);
          return;
        }
        req.studentSession = req.session;
        req.session = teacherSession;
        next();
      });
    });
  };
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
    secure: cookieSecure(),
    maxAge,
  };

  const baseOptions = {
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: cookieOptions,
  };

  const teacherMw = session({ ...baseOptions, name: 'sid' });
  const studentMw = session({ ...baseOptions, name: 'student_sid' });

  app.use(dualSession(teacherMw, studentMw) as never);
});

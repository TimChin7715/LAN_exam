import type session from 'express-session';
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    session: session.Session & Partial<session.SessionData>;
  }
}

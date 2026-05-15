import type { FastifyRequest } from 'fastify';
import type session from 'express-session';

export type AppSession = session.Session & Partial<session.SessionData>;

export function getRequestSession(
  request: FastifyRequest,
): AppSession | undefined {
  return request.raw.session;
}

export function getStudentSession(
  request: FastifyRequest,
): AppSession | undefined {
  return request.raw.studentSession;
}

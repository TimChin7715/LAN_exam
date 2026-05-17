import type { FastifyRequest } from 'fastify';
import type session from 'express-session';

export type AppSession = session.Session & Partial<session.SessionData>;

export function getRequestSession(
  request: FastifyRequest,
): AppSession | undefined {
  return request.raw.session;
}

/** @deprecated Alias for unified session — student and teacher share `sid`. */
export function getStudentSession(
  request: FastifyRequest,
): AppSession | undefined {
  return getRequestSession(request);
}

export function saveSession(appSession: AppSession): Promise<void> {
  return new Promise((resolve, reject) => {
    appSession.save((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

import type { FastifyRequest } from 'fastify';

import { getStudentSession } from './session.js';

export function getSessionRosterEntryId(
  request: FastifyRequest,
): string | undefined {
  return getStudentSession(request)?.studentRosterEntryId;
}

export function regenerateStudentSession(
  request: FastifyRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const studentSession = getStudentSession(request);
    if (!studentSession) {
      reject(new Error('Student session middleware not available'));
      return;
    }
    studentSession.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function destroyStudentSession(
  request: FastifyRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const studentSession = getStudentSession(request);
    if (!studentSession) {
      resolve();
      return;
    }
    studentSession.destroy((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

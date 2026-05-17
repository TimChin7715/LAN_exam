import type { FastifyRequest } from 'fastify';

import { getSessionTeacherId } from './auth.js';
import { getRequestSession, saveSession, type AppSession } from './session.js';

export function getSessionRosterEntryId(
  request: FastifyRequest,
): string | undefined {
  return getRequestSession(request)?.studentRosterEntryId;
}

export function regenerateStudentSession(
  request: FastifyRequest,
): Promise<void> {
  const appSession = getRequestSession(request);
  if (!appSession) {
    return Promise.reject(new Error('Session middleware not available'));
  }

  return new Promise((resolve, reject) => {
    appSession.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export async function establishStudentSession(
  request: FastifyRequest,
  rosterEntryId: string,
  studentName: string,
): Promise<void> {
  // Keep teacher admin session when verifying a student in the same browser (e.g. proctor testing).
  if (!getSessionTeacherId(request)) {
    await regenerateStudentSession(request);
  }

  const active = getRequestSession(request);
  if (!active) {
    throw new Error('Session middleware not available');
  }
  active.studentRosterEntryId = rosterEntryId;
  active.studentName = studentName;
  await saveSession(active);
}

export async function destroyStudentSession(
  request: FastifyRequest,
): Promise<void> {
  const appSession = getRequestSession(request);
  if (!appSession) {
    return;
  }

  delete appSession.studentRosterEntryId;
  delete appSession.studentName;
  await saveSession(appSession);
}

export type { AppSession };

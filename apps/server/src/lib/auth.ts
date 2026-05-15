import type { FastifyRequest } from 'fastify';
import type { Teacher } from '@prisma/client';

import { prisma } from './prisma.js';

export type SessionUser = Pick<
  Teacher,
  'username' | 'displayName' | 'mustChangePassword'
>;

export function getSessionTeacherId(request: FastifyRequest): string | undefined {
  const session = request.session;
  return session?.teacherId;
}

export async function loadSessionUser(
  request: FastifyRequest,
): Promise<SessionUser | null> {
  const teacherId = getSessionTeacherId(request);
  if (!teacherId) {
    return null;
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: {
      username: true,
      displayName: true,
      mustChangePassword: true,
    },
  });

  return teacher;
}

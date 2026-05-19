import type { FastifyRequest } from 'fastify';

import { getSessionTeacherId } from './auth.js';
import { prisma } from './prisma.js';

let cachedLocalAdminId: string | null = null;

export function isAdminAuthDisabled(): boolean {
  return (process.env.ADMIN_AUTH_MODE ?? 'disabled').toLowerCase() === 'disabled';
}

export function isAdminApiLoopbackOnly(): boolean {
  const raw = process.env.ADMIN_API_LOOPBACK_ONLY;
  if (raw === undefined || raw === '') {
    return true;
  }
  return raw.toLowerCase() !== 'false';
}

export function getLocalAdminUsername(): string {
  return process.env.LOCAL_ADMIN_USERNAME ?? 'local_exam_admin';
}

export async function getLocalAdminTeacherId(): Promise<string> {
  if (cachedLocalAdminId) {
    return cachedLocalAdminId;
  }

  const username = getLocalAdminUsername();
  const teacher = await prisma.teacher.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!teacher) {
    throw new Error(
      `Local admin teacher "${username}" not found. Run prisma migrate deploy && prisma db seed.`,
    );
  }

  cachedLocalAdminId = teacher.id;
  return teacher.id;
}

export async function resolveAdminTeacherId(
  request: FastifyRequest,
): Promise<string> {
  if (isAdminAuthDisabled()) {
    return getLocalAdminTeacherId();
  }

  const teacherId = getSessionTeacherId(request);
  if (!teacherId) {
    throw new Error('No admin session');
  }

  return teacherId;
}

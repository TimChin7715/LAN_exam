import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { getLocalAdminTeacherId } from '../../../lib/admin-context.js';
import { getTeacherShowSeatBoard } from '../../../lib/admin-settings.js';
import { resolvePublicSeatExam } from '../../../lib/seat/resolve-public-seat-exam.js';
import { prisma } from '../../../lib/prisma.js';

/** Teacher whose showSeatBoard setting applies when no public (draft/in-progress) exam. */
async function resolveSeatBoardTeacherId(
  db: PrismaClient,
  publicExam: { teacherId: string } | null,
): Promise<string> {
  if (publicExam) {
    return publicExam.teacherId;
  }

  const latestExam = await db.exam.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { teacherId: true },
  });
  if (latestExam) {
    return latestExam.teacherId;
  }

  return getLocalAdminTeacherId();
}

export async function registerStudentConfigRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/config',
    {
      config: {
        rateLimit: {
          max: Number(process.env.STUDENT_SEAT_BOARD_RATE_LIMIT_MAX ?? 60),
          timeWindow: '1 minute',
        },
      },
    },
    async (_request, reply) => {
      const exam = await resolvePublicSeatExam(prisma);
      const teacherId = await resolveSeatBoardTeacherId(prisma, exam);
      const showSeatBoard = await getTeacherShowSeatBoard(prisma, teacherId);

      return reply.send({ ok: true, showSeatBoard });
    },
  );
}

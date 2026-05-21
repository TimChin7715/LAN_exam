import type { FastifyInstance } from 'fastify';

import { getTeacherShowSeatBoard } from '../../../lib/admin-settings.js';
import { resolvePublicSeatExam } from '../../../lib/seat/resolve-public-seat-exam.js';
import { prisma } from '../../../lib/prisma.js';

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

      if (!exam) {
        return reply.send({ ok: true, showSeatBoard: true });
      }

      const showSeatBoard = await getTeacherShowSeatBoard(prisma, exam.teacherId);

      return reply.send({ ok: true, showSeatBoard });
    },
  );
}

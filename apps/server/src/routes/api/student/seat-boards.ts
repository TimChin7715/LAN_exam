import type { FastifyInstance } from 'fastify';

import { getTeacherShowSeatBoard } from '../../../lib/admin-settings.js';
import { loadExamSeatBoard } from '../../../lib/seat/load-seat-board.js';
import { resolvePublicSeatExam } from '../../../lib/seat/resolve-public-seat-exam.js';
import { prisma } from '../../../lib/prisma.js';

export async function registerStudentSeatBoardsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/seat-boards',
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
        return reply.send({ ok: true, board: null });
      }

      const showSeatBoard = await getTeacherShowSeatBoard(prisma, exam.teacherId);
      if (!showSeatBoard) {
        return reply.send({ ok: true, board: null });
      }

      const board = await loadExamSeatBoard(prisma, exam, {
        includeDisplayStatus: true,
      });

      return reply.send({ ok: true, board });
    },
  );
}

import type { FastifyInstance } from 'fastify';

import { listStudentSeatBoardExams } from '../../../lib/admin-settings.js';
import {
  loadExamSeatBoard,
  type SeatBoardPayload,
} from '../../../lib/seat/load-seat-board.js';
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
      const exams = await listStudentSeatBoardExams(prisma);

      if (exams.length === 0) {
        return reply.send({ ok: true, board: null, boards: [] });
      }

      const boards: SeatBoardPayload[] = [];

      for (const exam of exams) {
        const board = await loadExamSeatBoard(prisma, exam, {
          includeDisplayStatus: true,
        });
        if (!board) continue;

        boards.push({
          ...board,
          examId: exam.id,
          title: exam.title,
          status: exam.status,
        });
      }

      return reply.send({
        ok: true,
        board: boards[0] ?? null,
        boards,
      });
    },
  );
}

import type { FastifyInstance } from 'fastify';

import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { getTeacherShowSeatBoard } from '../../../lib/admin-settings.js';
import { loadExamSeatBoard } from '../../../lib/seat/load-seat-board.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

export async function registerAdminExamSeatsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/exams/:id/seats',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: {
          id: true,
          title: true,
          status: true,
          rosterBatchId: true,
        },
      });

      if (!exam) {
        return reply.status(404).send({
          error: 'Not found',
          code: 'EXAM_NOT_FOUND',
        });
      }

      const showSeatBoard = await getTeacherShowSeatBoard(prisma, teacherId);
      if (!showSeatBoard) {
        return reply.send({
          ok: true,
          examId: exam.id,
          title: exam.title,
          status: exam.status,
          cols: 0,
          rows: 0,
          items: [],
        });
      }

      const board = await loadExamSeatBoard(prisma, exam);

      return reply.send({ ok: true, ...board });
    },
  );
}

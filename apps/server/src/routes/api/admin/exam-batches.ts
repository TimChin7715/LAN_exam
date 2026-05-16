import type { FastifyInstance } from 'fastify';

import { getSessionTeacherId } from '../../../lib/auth.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

export async function registerAdminExamBatchesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/question-batches',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const batches = await prisma.questionImportBatch.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          _count: { select: { questions: true } },
        },
      });

      return reply.send({
        ok: true,
        items: batches.map((batch) => ({
          id: batch.id,
          fileName: batch.fileName,
          createdAt: batch.createdAt,
          itemCount: batch._count.questions,
        })),
      });
    },
  );

  app.get(
    '/api/admin/roster-batches',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const batches = await prisma.rosterImportBatch.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          _count: { select: { entries: true } },
        },
      });

      return reply.send({
        ok: true,
        items: batches.map((batch) => ({
          id: batch.id,
          fileName: batch.fileName,
          createdAt: batch.createdAt,
          itemCount: batch._count.entries,
        })),
      });
    },
  );
}

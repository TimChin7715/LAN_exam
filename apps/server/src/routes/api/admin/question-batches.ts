import type { FastifyInstance } from 'fastify';

import {
  BATCH_LINKED_TO_EXAM_MESSAGE,
  BatchDeleteBlockedError,
  deleteQuestionBatchIfUnused,
} from '../../../lib/batch/delete-with-exam-unlink.js';
import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

function mapBatchItem(batch: {
  id: string;
  fileName: string;
  createdAt: Date;
  _count: { questions: number };
}) {
  return {
    id: batch.id,
    fileName: batch.fileName,
    createdAt: batch.createdAt,
    itemCount: batch._count.questions,
  };
}

export async function registerAdminQuestionBatchesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/question-batches',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

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
        items: batches.map(mapBatchItem),
      });
    },
  );

  app.get(
    '/api/admin/question-batches/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.questionImportBatch.findFirst({
        where: { id, teacherId },
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          importedCount: true,
          skippedCount: true,
          totalRows: true,
          _count: { select: { questions: true } },
        },
      });

      if (!batch) {
        return reply.status(404).send({
          error: 'Not found',
          code: 'BATCH_NOT_FOUND',
        });
      }

      return reply.send({
        ok: true,
        batch: {
          id: batch.id,
          fileName: batch.fileName,
          createdAt: batch.createdAt,
          importedCount: batch.importedCount,
          skippedCount: batch.skippedCount,
          totalRows: batch.totalRows,
          itemCount: batch._count.questions,
        },
      });
    },
  );

  app.delete(
    '/api/admin/question-batches/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.questionImportBatch.findFirst({
        where: { id, teacherId },
        select: { id: true },
      });

      if (!batch) {
        return reply.status(404).send({
          error: 'Not found',
          code: 'BATCH_NOT_FOUND',
        });
      }

      try {
        await deleteQuestionBatchIfUnused(prisma, teacherId, id);
      } catch (err) {
        if (err instanceof BatchDeleteBlockedError) {
          return reply.status(409).send({
            error: 'Batch in use',
            code: 'BATCH_IN_USE',
            message: BATCH_LINKED_TO_EXAM_MESSAGE,
            examTitles: err.examTitles,
          });
        }
        throw err;
      }

      return reply.send({ ok: true });
    },
  );
}

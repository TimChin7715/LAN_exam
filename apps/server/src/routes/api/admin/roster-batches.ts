import type { FastifyInstance } from 'fastify';

import {
  BATCH_LINKED_TO_EXAM_MESSAGE,
  BatchDeleteBlockedError,
  deleteRosterBatchIfUnused,
} from '../../../lib/batch/delete-with-exam-unlink.js';
import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

function mapBatchItem(batch: {
  id: string;
  fileName: string;
  createdAt: Date;
  _count: { entries: number };
}) {
  return {
    id: batch.id,
    fileName: batch.fileName,
    createdAt: batch.createdAt,
    itemCount: batch._count.entries,
  };
}

export async function registerAdminRosterBatchesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/roster-batches',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

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
        items: batches.map(mapBatchItem),
      });
    },
  );

  app.get(
    '/api/admin/roster-batches/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.rosterImportBatch.findFirst({
        where: { id, teacherId },
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          importedCount: true,
          skippedCount: true,
          totalRows: true,
          _count: { select: { entries: true } },
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
          itemCount: batch._count.entries,
        },
      });
    },
  );

  app.delete(
    '/api/admin/roster-batches/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.rosterImportBatch.findFirst({
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
        await deleteRosterBatchIfUnused(prisma, teacherId, id);
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

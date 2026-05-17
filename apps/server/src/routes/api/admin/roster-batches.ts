import type { FastifyInstance } from 'fastify';

import { getSessionTeacherId } from '../../../lib/auth.js';
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
      const teacherId = getSessionTeacherId(request)!;

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
      const teacherId = getSessionTeacherId(request)!;
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
      const teacherId = getSessionTeacherId(request)!;
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

      const linkedExams = await prisma.exam.findMany({
        where: { rosterBatchId: id },
        select: { title: true },
        take: 3,
      });

      if (linkedExams.length > 0) {
        return reply.status(409).send({
          error: 'Batch in use',
          code: 'BATCH_IN_USE',
          examTitles: linkedExams.map((e) => e.title),
        });
      }

      await prisma.rosterImportBatch.delete({ where: { id } });

      return reply.send({ ok: true });
    },
  );
}

import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';

import {
  BatchDeleteBlockedError,
  unlinkExamsAndDeletePracticalBatch,
} from '../../../lib/batch/delete-with-exam-unlink.js';
import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { prisma } from '../../../lib/prisma.js';
import { readStorageFile, resolveStoragePath } from '../../../lib/storage/index.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

function mapBatchItem(batch: {
  id: string;
  title: string;
  wordFileName: string;
  excelFileName: string;
  createdAt: Date;
}) {
  return {
    id: batch.id,
    title: batch.title,
    wordFileName: batch.wordFileName,
    excelFileName: batch.excelFileName,
    createdAt: batch.createdAt,
  };
}

export async function registerAdminPracticalBatchesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/practical-batches',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const batches = await prisma.practicalQuestionImportBatch.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          wordFileName: true,
          excelFileName: true,
          createdAt: true,
        },
      });

      return reply.send({
        ok: true,
        items: batches.map(mapBatchItem),
      });
    },
  );

  app.get(
    '/api/admin/practical-batches/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.practicalQuestionImportBatch.findFirst({
        where: { id, teacherId },
        select: {
          id: true,
          title: true,
          wordFileName: true,
          excelFileName: true,
          createdAt: true,
        },
      });

      if (!batch) {
        return reply.status(404).send({
          ok: false,
          code: 'BATCH_NOT_FOUND',
          message: '操作题批次不存在',
        });
      }

      return reply.send({ ok: true, batch: mapBatchItem(batch) });
    },
  );

  app.get(
    '/api/admin/practical-batches/:id/files/word',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.practicalQuestionImportBatch.findFirst({
        where: { id, teacherId },
        select: { wordFileName: true, wordStorageKey: true },
      });

      if (!batch) {
        return reply.status(404).send({
          ok: false,
          code: 'BATCH_NOT_FOUND',
          message: '操作题批次不存在',
        });
      }

      const buffer = await readStorageFile(batch.wordStorageKey);
      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(batch.wordFileName)}`,
        )
        .send(buffer);
    },
  );

  app.delete(
    '/api/admin/practical-batches/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.practicalQuestionImportBatch.findFirst({
        where: { id, teacherId },
        select: { id: true, wordStorageKey: true },
      });

      if (!batch) {
        return reply.status(404).send({
          ok: false,
          code: 'BATCH_NOT_FOUND',
          message: '操作题批次不存在',
        });
      }

      try {
        await unlinkExamsAndDeletePracticalBatch(prisma, teacherId, id);
      } catch (err) {
        if (err instanceof BatchDeleteBlockedError) {
          return reply.status(409).send({
            ok: false,
            code: 'BATCH_IN_USE',
            message: err.message,
            examTitles: err.examTitles,
          });
        }
        throw err;
      }

      const dir = resolveStoragePath(`practical-batches/${id}`);
      await fs.promises.rm(dir, { recursive: true, force: true });

      return reply.send({ ok: true });
    },
  );
}

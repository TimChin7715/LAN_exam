import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';

import {
  BatchDeleteBlockedError,
  unlinkExamsAndDeleteFillInBatch,
} from '../../../lib/batch/delete-with-exam-unlink.js';
import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { questionImportOrderBy } from '../../../lib/qbank/question-import-order.js';
import { prisma } from '../../../lib/prisma.js';
import { readStorageFile, resolveStoragePath } from '../../../lib/storage/index.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

function mapBatchItem(batch: {
  id: string;
  title: string;
  wordFileName: string;
  excelFileName: string;
  importedCount: number;
  createdAt: Date;
}) {
  return {
    id: batch.id,
    title: batch.title,
    wordFileName: batch.wordFileName,
    excelFileName: batch.excelFileName,
    itemCount: batch.importedCount,
    createdAt: batch.createdAt,
  };
}

export async function registerAdminFillInBatchesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/fill-in-batches',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const batches = await prisma.fillInQuestionImportBatch.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          wordFileName: true,
          excelFileName: true,
          importedCount: true,
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
    '/api/admin/fill-in-batches/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.fillInQuestionImportBatch.findFirst({
        where: { id, teacherId },
        select: {
          id: true,
          title: true,
          wordFileName: true,
          excelFileName: true,
          importedCount: true,
          createdAt: true,
          questions: {
            orderBy: questionImportOrderBy,
            select: {
              id: true,
              stem: true,
              answerKeys: true,
              points: true,
            },
          },
        },
      });

      if (!batch) {
        return reply.status(404).send({
          ok: false,
          code: 'BATCH_NOT_FOUND',
          message: '填空题批次不存在',
        });
      }

      return reply.send({
        ok: true,
        batch: {
          ...mapBatchItem(batch),
          questions: batch.questions.map((q) => ({
            id: q.id,
            stem: q.stem,
            answerKeys: q.answerKeys,
            points: q.points,
          })),
        },
      });
    },
  );

  app.delete(
    '/api/admin/fill-in-batches/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const batch = await prisma.fillInQuestionImportBatch.findFirst({
        where: { id, teacherId },
        select: { id: true },
      });

      if (!batch) {
        return reply.status(404).send({
          ok: false,
          code: 'BATCH_NOT_FOUND',
          message: '填空题批次不存在',
        });
      }

      try {
        await unlinkExamsAndDeleteFillInBatch(prisma, teacherId, id);
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

      const dir = resolveStoragePath(`fill-in-batches/${id}`);
      await fs.promises.rm(dir, { recursive: true, force: true });

      return reply.send({ ok: true });
    },
  );
}

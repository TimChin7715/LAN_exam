import type { ExamContentModule } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import { requiresFillInBatch } from '../../../lib/exam/content-mode.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import {
  contentTypeForPreviewImage,
  ensureFillInWordPreview,
  isValidFillInPreviewImageName,
} from '../../../lib/fillin/generate-word-preview.js';
import { loadFillInWordPreviewHtml } from '../../../lib/fillin/preview-word.js';
import { prisma } from '../../../lib/prisma.js';
import {
  safeFillInAttachmentsZipFilename,
  streamFillInAttachmentsZip,
} from '../../../lib/fillin/build-attachments-zip.js';
import { listFillInBatchAttachments } from '../../../lib/fillin/load-batch-attachments.js';
import {
  contentTypeForWordFilename,
  fillInBatchPreviewImageKey,
  readStorageFile,
} from '../../../lib/storage/index.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

const examIdQuerySchema = z.object({
  examId: z.string().min(1),
});

const previewAssetQuerySchema = z.object({
  examId: z.string().min(1),
  v: z.string().min(1),
  name: z.string().min(1),
});

async function loadFillInExam(examId: string) {
  return prisma.exam.findUnique({
    where: { id: examId },
    select: {
      contentModules: true,
      fillInBatch: {
        select: {
          id: true,
          wordFileName: true,
          wordStorageKey: true,
        },
      },
    },
  });
}

type FillInExamRecord = {
  contentModules: ExamContentModule[];
  fillInBatch: {
    id: string;
    wordFileName: string;
    wordStorageKey: string;
  };
};

function assertFillInExam(
  exam: Awaited<ReturnType<typeof loadFillInExam>>,
): FillInExamRecord {
  if (!exam?.fillInBatch || !requiresFillInBatch(exam.contentModules)) {
    throw new ExamAccessError(404, 'NOT_FOUND', '本场考试无填空题资料');
  }
  return {
    contentModules: exam.contentModules,
    fillInBatch: exam.fillInBatch,
  };
}

async function assertFillInReadAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  examId: string,
): Promise<string | FastifyReply> {
  const rosterEntryId = await ensureStudentRosterEntryId(request, reply);
  if (typeof rosterEntryId !== 'string') return rosterEntryId;

  try {
    await assertStudentExamAccess(rosterEntryId, examId, 'read');
  } catch (err) {
    if (err instanceof ExamAccessError) {
      return reply.status(err.statusCode).send({
        code: err.code,
        message: err.message,
      });
    }
    throw err;
  }
  return rosterEntryId;
}

export async function registerStudentExamFillInRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/exam/fillin/word',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterEntryId !== 'string') return rosterEntryId;

      const parsed = examIdQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId } = parsed.data;

      try {
        await assertStudentExamAccess(rosterEntryId, examId, 'read');
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      let exam: FillInExamRecord;
      try {
        exam = assertFillInExam(await loadFillInExam(examId));
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const buffer = await readStorageFile(exam.fillInBatch.wordStorageKey);
      return reply
        .header(
          'Content-Type',
          contentTypeForWordFilename(exam.fillInBatch.wordFileName),
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(exam.fillInBatch.wordFileName)}`,
        )
        .send(buffer);
    },
  );

  app.get(
    '/api/student/exam/fillin/word/preview',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const parsed = examIdQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId } = parsed.data;
      const access = await assertFillInReadAccess(request, reply, examId);
      if (typeof access !== 'string') return access;

      let exam: FillInExamRecord;
      try {
        exam = assertFillInExam(await loadFillInExam(examId));
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const { html, version } = await loadFillInWordPreviewHtml({
        batchId: exam.fillInBatch.id,
        wordStorageKey: exam.fillInBatch.wordStorageKey,
        wordFileName: exam.fillInBatch.wordFileName,
        examId,
      });

      const etag = `"${version}"`;
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        return reply
          .status(304)
          .header('Cache-Control', 'private, max-age=86400')
          .header('ETag', etag)
          .send();
      }

      return reply
        .header('Cache-Control', 'private, max-age=86400')
        .header('ETag', etag)
        .send({ ok: true, html, version });
    },
  );

  app.get(
    '/api/student/exam/fillin/word/preview/asset',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const parsed = previewAssetQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId, v, name } = parsed.data;
      if (!isValidFillInPreviewImageName(name)) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '无效的图片资源',
        });
      }

      const access = await assertFillInReadAccess(request, reply, examId);
      if (typeof access !== 'string') return access;

      let exam: FillInExamRecord;
      try {
        exam = assertFillInExam(await loadFillInExam(examId));
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const meta = await ensureFillInWordPreview(
        exam.fillInBatch.id,
        exam.fillInBatch.wordStorageKey,
        exam.fillInBatch.wordFileName,
      );
      if (meta.version !== v) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: '预览资源已更新，请刷新页面',
        });
      }

      const buffer = await readStorageFile(
        fillInBatchPreviewImageKey(exam.fillInBatch.id, name),
      );
      const etag = `"${meta.version}-${name}"`;
      if (request.headers['if-none-match'] === etag) {
        return reply
          .status(304)
          .header('Cache-Control', 'private, max-age=31536000, immutable')
          .header('ETag', etag)
          .send();
      }

      return reply
        .header('Content-Type', contentTypeForPreviewImage(name))
        .header('Cache-Control', 'private, max-age=31536000, immutable')
        .header('ETag', etag)
        .send(buffer);
    },
  );

  app.get(
    '/api/student/exam/fillin/attachment',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterEntryId !== 'string') return rosterEntryId;

      const parsed = examIdQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId } = parsed.data;

      try {
        await assertStudentExamAccess(rosterEntryId, examId, 'read');
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: {
          contentModules: true,
          fillInBatch: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (
        !exam?.fillInBatch ||
        !requiresFillInBatch(exam.contentModules)
      ) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: '本场考试无填空题附件',
        });
      }

      const attachments = await listFillInBatchAttachments(
        prisma,
        exam.fillInBatch.id,
      );
      if (attachments.length === 0) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: '本场考试无填空题附件',
        });
      }

      const filename = safeFillInAttachmentsZipFilename(exam.fillInBatch.title);
      const stream = await streamFillInAttachmentsZip(
        attachments.map((a) => ({
          fileName: a.fileName,
          storageKey: a.storageKey,
        })),
      );

      return reply
        .header('Content-Type', 'application/zip')
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        )
        .send(stream);
    },
  );
}

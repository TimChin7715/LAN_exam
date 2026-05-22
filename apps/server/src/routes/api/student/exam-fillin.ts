import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import { requiresFillInBatch } from '../../../lib/exam/content-mode.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { prisma } from '../../../lib/prisma.js';
import { previewWordDocument } from '../../../lib/fillin/preview-word.js';
import {
  contentTypeForSpreadsheetFilename,
  contentTypeForWordFilename,
  readStorageFile,
} from '../../../lib/storage/index.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

const examIdQuerySchema = z.object({
  examId: z.string().min(1),
});

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

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: {
          contentModules: true,
          fillInBatch: {
            select: { wordFileName: true, wordStorageKey: true },
          },
        },
      });

      if (
        !exam?.fillInBatch ||
        !requiresFillInBatch(exam.contentModules)
      ) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: '本场考试无填空题资料',
        });
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
            select: { wordFileName: true, wordStorageKey: true },
          },
        },
      });

      if (
        !exam?.fillInBatch ||
        !requiresFillInBatch(exam.contentModules)
      ) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: '本场考试无填空题资料',
        });
      }

      const buffer = await readStorageFile(exam.fillInBatch.wordStorageKey);
      const html = await previewWordDocument(
        buffer,
        exam.fillInBatch.wordFileName,
      );
      return reply.send({ ok: true, html });
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
              attachmentFileName: true,
              attachmentStorageKey: true,
            },
          },
        },
      });

      if (
        !exam?.fillInBatch?.attachmentStorageKey ||
        !exam.fillInBatch.attachmentFileName ||
        !requiresFillInBatch(exam.contentModules)
      ) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: '本场考试无填空题附件',
        });
      }

      const buffer = await readStorageFile(exam.fillInBatch.attachmentStorageKey);
      return reply
        .header(
          'Content-Type',
          contentTypeForSpreadsheetFilename(exam.fillInBatch.attachmentFileName),
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(exam.fillInBatch.attachmentFileName)}`,
        )
        .send(buffer);
    },
  );
}

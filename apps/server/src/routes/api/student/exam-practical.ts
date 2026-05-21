import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import { requiresPracticalBatch } from '../../../lib/exam/content-mode.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { ensureStudentPaperCopy } from '../../../lib/practical/ensure-paper-copy.js';
import { contentTypeForSpreadsheetFilename } from '../../../lib/practical/spreadsheet-file.js';
import { prisma } from '../../../lib/prisma.js';
import {
  assertValidWordUpload,
  contentTypeForWordFilename,
  examWorkAnswerKey,
  examWorkPaperKey,
  getMaxWordUploadBytes,
  readStorageFile,
  writeStorageFile,
  wordUploadExt,
} from '../../../lib/storage/index.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

const examIdQuerySchema = z.object({
  examId: z.string().min(1),
});

async function loadExamWithPractical(examId: string) {
  return prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      contentModules: true,
      practicalBatch: {
        select: {
          title: true,
          wordFileName: true,
          wordStorageKey: true,
          excelFileName: true,
          excelStorageKey: true,
        },
      },
    },
  });
}

export async function registerStudentExamPracticalRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/exam/practical/paper',
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

      const exam = await loadExamWithPractical(examId);
      if (!exam?.practicalBatch || !requiresPracticalBatch(exam.contentModules)) {
        return reply.status(404).send({
          code: 'NO_PRACTICAL',
          message: '本场考试不含操作题',
        });
      }

      await ensureStudentPaperCopy(prisma, {
        examId,
        rosterEntryId,
        batchWordStorageKey: exam.practicalBatch.wordStorageKey,
      });

      const buffer = await readStorageFile(
        examWorkPaperKey(examId, rosterEntryId),
      );

      return reply
        .header(
          'Content-Type',
          contentTypeForWordFilename(exam.practicalBatch.wordFileName),
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(exam.practicalBatch.wordFileName)}`,
        )
        .send(buffer);
    },
  );

  app.get(
    '/api/student/exam/practical/excel',
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

      const exam = await loadExamWithPractical(examId);
      if (!exam?.practicalBatch || !requiresPracticalBatch(exam.contentModules)) {
        return reply.status(404).send({
          code: 'NO_PRACTICAL',
          message: '本场考试不含操作题',
        });
      }

      const buffer = await readStorageFile(exam.practicalBatch.excelStorageKey);
      return reply
        .header(
          'Content-Type',
          contentTypeForSpreadsheetFilename(exam.practicalBatch.excelFileName),
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(exam.practicalBatch.excelFileName)}`,
        )
        .send(buffer);
    },
  );

  app.get(
    '/api/student/exam/practical/answer',
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

      const submitted = await prisma.practicalSubmission.findUnique({
        where: { examId_rosterEntryId: { examId, rosterEntryId } },
      });
      const draft = submitted
        ? null
        : await prisma.practicalAnswerDraft.findUnique({
            where: { examId_rosterEntryId: { examId, rosterEntryId } },
          });

      const source = submitted ?? draft;
      if (!source) {
        return reply.status(404).send({
          code: 'NO_ANSWER',
          message: '尚未上传操作题作答',
        });
      }

      const buffer = await readStorageFile(source.docxStorageKey);
      return reply
        .header(
          'Content-Type',
          contentTypeForWordFilename(source.docxFileName),
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(source.docxFileName)}`,
        )
        .send(buffer);
    },
  );

  app.put(
    '/api/student/exam/practical/answer',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterEntryId !== 'string') return rosterEntryId;

      const examIdField = (request.query as { examId?: string }).examId;
      if (!examIdField) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '缺少 examId 参数',
        });
      }

      const examId = examIdField;

      try {
        await assertStudentExamAccess(rosterEntryId, examId, 'write');
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const submitted = await prisma.practicalSubmission.findUnique({
        where: { examId_rosterEntryId: { examId, rosterEntryId } },
      });
      if (submitted) {
        return reply.status(409).send({
          code: 'ALREADY_SUBMITTED',
          message: '已交卷，无法继续上传操作题作答',
        });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          code: 'MISSING_FILE',
          message: '请上传 file 字段',
        });
      }

      const buffer = await data.toBuffer();
      const check = assertValidWordUpload(
        data.filename,
        data.mimetype,
        buffer,
        getMaxWordUploadBytes(),
      );
      if (!check.ok) {
        return reply.status(400).send({
          code: 'INVALID_FILE',
          message: check.message,
        });
      }

      const ext = wordUploadExt(data.filename) ?? 'docx';
      const storageKey = examWorkAnswerKey(examId, rosterEntryId, ext);
      await writeStorageFile(storageKey, buffer);

      const draft = await prisma.practicalAnswerDraft.upsert({
        where: { examId_rosterEntryId: { examId, rosterEntryId } },
        create: {
          examId,
          rosterEntryId,
          docxStorageKey: storageKey,
          docxFileName: data.filename,
        },
        update: {
          docxStorageKey: storageKey,
          docxFileName: data.filename,
        },
        select: { updatedAt: true, docxFileName: true },
      });

      return reply.send({
        ok: true,
        docxFileName: draft.docxFileName,
        updatedAt: draft.updatedAt,
      });
    },
  );
}

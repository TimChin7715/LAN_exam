import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import { requiresFillInBatch } from '../../../lib/exam/content-mode.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { prisma } from '../../../lib/prisma.js';
import {
  assertValidImageUpload,
  deleteStorageFile,
  examWorkFillInScreenshotKey,
  getMaxFillInScreenshotBytes,
  MAX_FILLIN_SCREENSHOTS_PER_BLANK,
  readStorageFile,
  writeStorageFile,
} from '../../../lib/storage/index.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

const examIdQuerySchema = z.object({
  examId: z.string().min(1),
});

const postQuerySchema = z.object({
  examId: z.string().min(1),
  examQuestionId: z.string().min(1),
});

const idParamSchema = z.object({
  id: z.string().min(1),
});

function previewUrl(examId: string, screenshotId: string): string {
  return `/api/student/exam/fillin/screenshots/${encodeURIComponent(screenshotId)}/file?examId=${encodeURIComponent(examId)}`;
}

async function loadExamWithFillIn(examId: string) {
  return prisma.exam.findUnique({
    where: { id: examId },
    select: { id: true, contentModules: true, fillInBatchId: true },
  });
}

async function assertFillInQuestion(
  examId: string,
  examQuestionId: string,
): Promise<void> {
  const eq = await prisma.examQuestion.findFirst({
    where: { id: examQuestionId, examId },
    include: { question: { select: { type: true } } },
  });
  if (!eq || eq.question.type !== 'FILL') {
    throw new ExamAccessError(404, 'NOT_FOUND', '题目不存在');
  }
}

/** 作答中读权限，或已交卷后回看 */
async function assertFillInScreenshotRead(
  rosterEntryId: string,
  examId: string,
): Promise<void> {
  try {
    await assertStudentExamAccess(rosterEntryId, examId, 'read');
    return;
  } catch (err) {
    if (!(err instanceof ExamAccessError)) throw err;
  }

  const entry = await prisma.rosterEntry.findUnique({
    where: { id: rosterEntryId },
    select: { batchId: true },
  });
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { rosterBatchId: true },
  });
  if (!entry || !exam || entry.batchId !== exam.rosterBatchId) {
    throw new ExamAccessError(403, 'FORBIDDEN', '当前无法查看本场考试。');
  }

  const submitted = await prisma.submission.findUnique({
    where: { examId_rosterEntryId: { examId, rosterEntryId } },
    select: { id: true },
  });
  if (!submitted) {
    throw new ExamAccessError(403, 'FORBIDDEN', '当前无法查看本场考试。');
  }
}

export async function registerStudentExamFillInScreenshotRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/exam/fillin/screenshots',
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
        await assertFillInScreenshotRead(rosterEntryId, examId);
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const exam = await loadExamWithFillIn(examId);
      if (!exam?.fillInBatchId || !requiresFillInBatch(exam.contentModules)) {
        return reply.send({ ok: true, items: [] });
      }

      const submitted = await prisma.submission.findUnique({
        where: { examId_rosterEntryId: { examId, rosterEntryId } },
        select: { id: true },
      });

      const rows = submitted
        ? await prisma.fillInScreenshot.findMany({
            where: { submissionId: submitted.id },
            orderBy: [{ examQuestionId: 'asc' }, { sortOrder: 'asc' }],
            select: {
              id: true,
              examQuestionId: true,
              sortOrder: true,
            },
          })
        : await prisma.fillInScreenshotDraft.findMany({
            where: { examId, rosterEntryId },
            orderBy: [{ examQuestionId: 'asc' }, { sortOrder: 'asc' }],
            select: {
              id: true,
              examQuestionId: true,
              sortOrder: true,
            },
          });

      const byQuestion = new Map<
        string,
        { id: string; sortOrder: number; previewUrl: string }[]
      >();
      for (const row of rows) {
        const list = byQuestion.get(row.examQuestionId) ?? [];
        list.push({
          id: row.id,
          sortOrder: row.sortOrder,
          previewUrl: previewUrl(examId, row.id),
        });
        byQuestion.set(row.examQuestionId, list);
      }

      const items = [...byQuestion.entries()].map(
        ([examQuestionId, screenshots]) => ({
          examQuestionId,
          screenshots,
        }),
      );

      return reply.send({ ok: true, items });
    },
  );

  app.get(
    '/api/student/exam/fillin/screenshots/:id/file',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterEntryId !== 'string') return rosterEntryId;

      const parsedQuery = examIdQuerySchema.safeParse(request.query);
      const parsedParams = idParamSchema.safeParse(request.params);
      if (!parsedQuery.success || !parsedParams.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId } = parsedQuery.data;
      const { id } = parsedParams.data;

      try {
        await assertFillInScreenshotRead(rosterEntryId, examId);
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const submitted = await prisma.submission.findUnique({
        where: { examId_rosterEntryId: { examId, rosterEntryId } },
        select: { id: true },
      });

      const draft = submitted
        ? null
        : await prisma.fillInScreenshotDraft.findFirst({
            where: { id, examId, rosterEntryId },
          });
      const final =
        submitted &&
        (await prisma.fillInScreenshot.findFirst({
          where: { id, submissionId: submitted.id },
        }));

      const row = draft ?? final;
      if (!row) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: '截图不存在',
        });
      }

      const buffer = await readStorageFile(row.storageKey);
      return reply
        .header('Content-Type', row.mimeType)
        .header('Cache-Control', 'private, max-age=3600')
        .send(buffer);
    },
  );

  app.post(
    '/api/student/exam/fillin/screenshots',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterEntryId !== 'string') return rosterEntryId;

      const parsedQuery = postQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId, examQuestionId } = parsedQuery.data;

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

      const submitted = await prisma.submission.findUnique({
        where: { examId_rosterEntryId: { examId, rosterEntryId } },
      });
      if (submitted) {
        return reply.status(409).send({
          code: 'ALREADY_SUBMITTED',
          message: '已交卷，无法继续上传截图',
        });
      }

      const exam = await loadExamWithFillIn(examId);
      if (!exam?.fillInBatchId || !requiresFillInBatch(exam.contentModules)) {
        return reply.status(404).send({
          code: 'NO_FILL_IN',
          message: '本场考试不含填空题',
        });
      }

      try {
        await assertFillInQuestion(examId, examQuestionId);
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          code: 'MISSING_FILE',
          message: '请上传 file 字段',
        });
      }

      const buffer = await data.toBuffer();
      const check = assertValidImageUpload(
        data.filename,
        data.mimetype,
        buffer,
        getMaxFillInScreenshotBytes(),
      );
      if (!check.ok) {
        return reply.status(400).send({
          code: 'INVALID_FILE',
          message: check.message,
        });
      }

      const count = await prisma.fillInScreenshotDraft.count({
        where: { examId, rosterEntryId, examQuestionId },
      });
      if (count >= MAX_FILLIN_SCREENSHOTS_PER_BLANK) {
        return reply.status(400).send({
          code: 'LIMIT_REACHED',
          message: `每空最多上传 ${MAX_FILLIN_SCREENSHOTS_PER_BLANK} 张截图`,
        });
      }

      const screenshotId = randomUUID();
      const storageKey = examWorkFillInScreenshotKey(
        examId,
        rosterEntryId,
        examQuestionId,
        screenshotId,
        check.ext,
      );
      await writeStorageFile(storageKey, buffer);

      const created = await prisma.fillInScreenshotDraft.create({
        data: {
          examId,
          rosterEntryId,
          examQuestionId,
          sortOrder: count,
          storageKey,
          mimeType: check.mimeType,
          byteSize: buffer.length,
        },
        select: { id: true, sortOrder: true },
      });

      return reply.send({
        ok: true,
        screenshot: {
          id: created.id,
          sortOrder: created.sortOrder,
          previewUrl: previewUrl(examId, created.id),
        },
      });
    },
  );

  app.delete(
    '/api/student/exam/fillin/screenshots/:id',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterEntryId !== 'string') return rosterEntryId;

      const parsedQuery = examIdQuerySchema.safeParse(request.query);
      const parsedParams = idParamSchema.safeParse(request.params);
      if (!parsedQuery.success || !parsedParams.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId } = parsedQuery.data;
      const { id } = parsedParams.data;

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

      const submitted = await prisma.submission.findUnique({
        where: { examId_rosterEntryId: { examId, rosterEntryId } },
      });
      if (submitted) {
        return reply.status(409).send({
          code: 'ALREADY_SUBMITTED',
          message: '已交卷，无法删除截图',
        });
      }

      const row = await prisma.fillInScreenshotDraft.findFirst({
        where: { id, examId, rosterEntryId },
      });
      if (!row) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: '截图不存在',
        });
      }

      await deleteStorageFile(row.storageKey);
      await prisma.fillInScreenshotDraft.delete({ where: { id } });

      const remaining = await prisma.fillInScreenshotDraft.findMany({
        where: { examId, rosterEntryId, examQuestionId: row.examQuestionId },
        orderBy: { sortOrder: 'asc' },
      });
      for (let i = 0; i < remaining.length; i++) {
        const r = remaining[i]!;
        if (r.sortOrder !== i) {
          await prisma.fillInScreenshotDraft.update({
            where: { id: r.id },
            data: { sortOrder: i },
          });
        }
      }

      return reply.send({ ok: true });
    },
  );
}

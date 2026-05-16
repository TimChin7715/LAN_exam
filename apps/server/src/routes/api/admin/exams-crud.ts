import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { getSessionTeacherId } from '../../../lib/auth.js';
import { materializeExamQuestions } from '../../../lib/exam/materialize-questions.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const createBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  questionBatchId: z.string().min(1),
  rosterBatchId: z.string().min(1),
});

const patchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    questionBatchId: z.string().min(1).optional(),
    rosterBatchId: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.questionBatchId !== undefined ||
      data.rosterBatchId !== undefined,
    { message: '至少提供一个可更新字段' },
  );

async function assertTeacherOwnsBatches(
  teacherId: string,
  questionBatchId: string,
  rosterBatchId: string,
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const [questionBatch, rosterBatch] = await Promise.all([
    prisma.questionImportBatch.findFirst({
      where: { id: questionBatchId, teacherId },
      select: { id: true },
    }),
    prisma.rosterImportBatch.findFirst({
      where: { id: rosterBatchId, teacherId },
      select: { id: true },
    }),
  ]);

  if (!questionBatch) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_QUESTION_BATCH',
      message: '题目批次不存在或无权使用',
    };
  }

  if (!rosterBatch) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_ROSTER_BATCH',
      message: '名单批次不存在或无权使用',
    };
  }

  return { ok: true };
}

export async function registerAdminExamsCrudRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/exams',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const exams = await prisma.exam.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
          questionBatch: { select: { id: true, fileName: true } },
          rosterBatch: { select: { id: true, fileName: true } },
          _count: { select: { submissions: true, questions: true } },
        },
      });

      return reply.send({
        ok: true,
        items: exams.map((exam) => ({
          id: exam.id,
          title: exam.title,
          status: exam.status,
          startedAt: exam.startedAt,
          endedAt: exam.endedAt,
          createdAt: exam.createdAt,
          questionBatchFileName: exam.questionBatch.fileName,
          rosterBatchFileName: exam.rosterBatch.fileName,
          questionCount: exam._count.questions,
          submissionCount: exam._count.submissions,
        })),
      });
    },
  );

  app.post(
    '/api/admin/exams',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
        });
      }

      const batchCheck = await assertTeacherOwnsBatches(
        teacherId,
        parsed.data.questionBatchId,
        parsed.data.rosterBatchId,
      );
      if (!batchCheck.ok) {
        return reply.status(batchCheck.status).send({
          ok: false,
          code: batchCheck.code,
          message: batchCheck.message,
        });
      }

      const exam = await prisma.$transaction(
        async (tx) => {
          const created = await tx.exam.create({
            data: {
              title: parsed.data.title,
              teacherId,
              questionBatchId: parsed.data.questionBatchId,
              rosterBatchId: parsed.data.rosterBatchId,
            },
          });
          await materializeExamQuestions(
            tx,
            created.id,
            parsed.data.questionBatchId,
          );
          return created;
        },
        { timeout: 30_000 },
      );

      return reply.status(201).send({ ok: true, examId: exam.id });
    },
  );

  app.get(
    '/api/admin/exams/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        include: {
          questionBatch: { select: { id: true, fileName: true, createdAt: true } },
          rosterBatch: { select: { id: true, fileName: true, createdAt: true } },
          questions: {
            orderBy: { sortOrder: 'asc' },
            include: {
              question: {
                select: {
                  id: true,
                  type: true,
                  stem: true,
                  points: true,
                  answerKeys: true,
                  options: {
                    orderBy: { sortOrder: 'asc' },
                    select: { key: true, text: true, sortOrder: true },
                  },
                },
              },
            },
          },
          _count: { select: { submissions: true } },
        },
      });

      if (!exam) {
        return reply.status(404).send({
          error: 'Not found',
          code: 'EXAM_NOT_FOUND',
        });
      }

      return reply.send({ ok: true, exam });
    },
  );

  app.patch(
    '/api/admin/exams/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };
      const parsed = patchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
        });
      }

      const existing = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: {
          id: true,
          status: true,
          questionBatchId: true,
          rosterBatchId: true,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'Not found',
          code: 'EXAM_NOT_FOUND',
        });
      }

      if (existing.status !== 'DRAFT') {
        return reply.status(409).send({
          ok: false,
          code: 'INVALID_STATUS',
          message: '仅草稿状态的考试可以编辑',
        });
      }

      const nextQuestionBatchId =
        parsed.data.questionBatchId ?? existing.questionBatchId;
      const nextRosterBatchId =
        parsed.data.rosterBatchId ?? existing.rosterBatchId;

      if (
        parsed.data.questionBatchId !== undefined ||
        parsed.data.rosterBatchId !== undefined
      ) {
        const batchCheck = await assertTeacherOwnsBatches(
          teacherId,
          nextQuestionBatchId,
          nextRosterBatchId,
        );
        if (!batchCheck.ok) {
          return reply.status(batchCheck.status).send({
            ok: false,
            code: batchCheck.code,
            message: batchCheck.message,
          });
        }
      }

      const questionBatchChanged =
        parsed.data.questionBatchId !== undefined &&
        parsed.data.questionBatchId !== existing.questionBatchId;

      await prisma.$transaction(
        async (tx) => {
          await tx.exam.update({
            where: { id },
            data: {
              ...(parsed.data.title !== undefined
                ? { title: parsed.data.title }
                : {}),
              ...(parsed.data.questionBatchId !== undefined
                ? { questionBatchId: parsed.data.questionBatchId }
                : {}),
              ...(parsed.data.rosterBatchId !== undefined
                ? { rosterBatchId: parsed.data.rosterBatchId }
                : {}),
            },
          });

          if (questionBatchChanged) {
            await materializeExamQuestions(tx, id, nextQuestionBatchId);
          }
        },
        { timeout: 30_000 },
      );

      return reply.send({ ok: true });
    },
  );
}

import type { ExamContentModule } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import {
  assertTeacherOwnsExamBatches,
  contentModulesSchema,
  hasContentModule,
  requiresFillInBatch,
  requiresObjectiveBatch,
} from '../../../lib/exam/content-mode.js';
import { invalidateExamPaperCache } from '../../../lib/exam/exam-paper-cache.js';
import { materializeExamQuestionSets } from '../../../lib/exam/materialize-questions.js';
import { assignExamSeats } from '../../../lib/seat/assign-seats.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const createBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    contentModules: contentModulesSchema,
    questionBatchId: z.string().min(1).optional(),
    fillInBatchId: z.string().min(1).optional(),
    practicalBatchId: z.string().min(1).optional(),
    rosterBatchId: z.string().min(1),
    scheduledStartAt: z.string().datetime(),
    scheduledEndAt: z.string().datetime(),
  })
  .refine(
    (data) => new Date(data.scheduledEndAt) > new Date(data.scheduledStartAt),
    {
      message: '结束时间必须晚于开始时间',
      path: ['scheduledEndAt'],
    },
  );

const patchBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    contentModules: contentModulesSchema.optional(),
    questionBatchId: z.string().min(1).nullable().optional(),
    fillInBatchId: z.string().min(1).nullable().optional(),
    practicalBatchId: z.string().min(1).nullable().optional(),
    rosterBatchId: z.string().min(1).optional(),
    scheduledStartAt: z.string().datetime().optional(),
    scheduledEndAt: z.string().datetime().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.contentModules !== undefined ||
      data.questionBatchId !== undefined ||
      data.fillInBatchId !== undefined ||
      data.practicalBatchId !== undefined ||
      data.rosterBatchId !== undefined ||
      data.scheduledStartAt !== undefined ||
      data.scheduledEndAt !== undefined,
    { message: '至少提供一个可更新字段' },
  );

function needsQuestionMaterialize(modules: ExamContentModule[]): boolean {
  return requiresObjectiveBatch(modules) || requiresFillInBatch(modules);
}

export async function registerAdminExamsCrudRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/exams',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const exams = await prisma.exam.findMany({
        where: { teacherId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          contentModules: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
          questionBatch: { select: { id: true, fileName: true } },
          fillInBatch: { select: { id: true, title: true } },
          practicalBatch: {
            select: { id: true, title: true, wordFileName: true },
          },
          rosterBatch: { select: { id: true, fileName: true } },
          _count: {
            select: {
              submissions: true,
              questions: true,
              practicalSubmissions: true,
            },
          },
        },
      });

      return reply.send({
        ok: true,
        items: exams.map((exam) => ({
          id: exam.id,
          title: exam.title,
          status: exam.status,
          contentModules: exam.contentModules,
          scheduledStartAt: exam.scheduledStartAt,
          scheduledEndAt: exam.scheduledEndAt,
          startedAt: exam.startedAt,
          endedAt: exam.endedAt,
          createdAt: exam.createdAt,
          questionBatchFileName: exam.questionBatch?.fileName ?? null,
          fillInBatchTitle: exam.fillInBatch?.title ?? null,
          practicalBatchTitle: exam.practicalBatch?.title ?? null,
          rosterBatchFileName: exam.rosterBatch.fileName,
          questionCount: exam._count.questions,
          submissionCount: exam._count.submissions,
          practicalSubmissionCount: exam._count.practicalSubmissions,
        })),
      });
    },
  );

  app.post(
    '/api/admin/exams',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
        });
      }

      const batchCheck = await assertTeacherOwnsExamBatches(teacherId, {
        contentModules: parsed.data.contentModules,
        questionBatchId: parsed.data.questionBatchId,
        fillInBatchId: parsed.data.fillInBatchId,
        practicalBatchId: parsed.data.practicalBatchId,
        rosterBatchId: parsed.data.rosterBatchId,
      });
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
              contentModules: parsed.data.contentModules,
              teacherId,
              questionBatchId: parsed.data.questionBatchId ?? null,
              fillInBatchId: parsed.data.fillInBatchId ?? null,
              practicalBatchId: parsed.data.practicalBatchId ?? null,
              rosterBatchId: parsed.data.rosterBatchId,
              scheduledStartAt: new Date(parsed.data.scheduledStartAt),
              scheduledEndAt: new Date(parsed.data.scheduledEndAt),
            },
          });
          if (needsQuestionMaterialize(parsed.data.contentModules)) {
            await materializeExamQuestionSets(tx, created.id, {
              questionBatchId: parsed.data.questionBatchId,
              fillInBatchId: parsed.data.fillInBatchId,
            });
          }
          await assignExamSeats(tx, created.id, parsed.data.rosterBatchId);
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
      const teacherId = await resolveAdminTeacherId(request);

      const { id } = request.params as { id: string };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        include: {
          questionBatch: {
            select: { id: true, fileName: true, createdAt: true },
          },
          fillInBatch: {
            select: {
              id: true,
              title: true,
              wordFileName: true,
              excelFileName: true,
              createdAt: true,
            },
          },
          practicalBatch: {
            select: {
              id: true,
              title: true,
              wordFileName: true,
              excelFileName: true,
              createdAt: true,
            },
          },
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
          _count: {
            select: { submissions: true, practicalSubmissions: true },
          },
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
      const teacherId = await resolveAdminTeacherId(request);

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
          contentModules: true,
          questionBatchId: true,
          fillInBatchId: true,
          practicalBatchId: true,
          rosterBatchId: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'Not found',
          code: 'EXAM_NOT_FOUND',
        });
      }

      if (existing.status !== 'DRAFT' && existing.status !== 'IN_PROGRESS') {
        return reply.status(409).send({
          ok: false,
          code: 'INVALID_STATUS',
          message: '仅草稿或进行中状态的考试可以编辑',
        });
      }

      const nextModules =
        parsed.data.contentModules ?? existing.contentModules;
      const nextQuestionBatchId =
        parsed.data.questionBatchId !== undefined
          ? parsed.data.questionBatchId
          : existing.questionBatchId;
      const nextFillInBatchId =
        parsed.data.fillInBatchId !== undefined
          ? parsed.data.fillInBatchId
          : existing.fillInBatchId;
      const nextPracticalBatchId =
        parsed.data.practicalBatchId !== undefined
          ? parsed.data.practicalBatchId
          : existing.practicalBatchId;
      const nextRosterBatchId =
        parsed.data.rosterBatchId ?? existing.rosterBatchId;
      const nextScheduledStartAt =
        parsed.data.scheduledStartAt !== undefined
          ? new Date(parsed.data.scheduledStartAt)
          : existing.scheduledStartAt;
      const nextScheduledEndAt =
        parsed.data.scheduledEndAt !== undefined
          ? new Date(parsed.data.scheduledEndAt)
          : existing.scheduledEndAt;

      if (!nextScheduledStartAt || !nextScheduledEndAt) {
        return reply.status(400).send({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: '开始时间与结束时间不能为空',
        });
      }

      if (!(nextScheduledEndAt > nextScheduledStartAt)) {
        return reply.status(400).send({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: '结束时间必须晚于开始时间',
        });
      }

      const batchCheck = await assertTeacherOwnsExamBatches(teacherId, {
        contentModules: nextModules,
        questionBatchId: nextQuestionBatchId,
        fillInBatchId: nextFillInBatchId,
        practicalBatchId: nextPracticalBatchId,
        rosterBatchId: nextRosterBatchId,
      });
      if (!batchCheck.ok) {
        return reply.status(batchCheck.status).send({
          ok: false,
          code: batchCheck.code,
          message: batchCheck.message,
        });
      }

      const rosterBatchChanged =
        parsed.data.rosterBatchId !== undefined &&
        parsed.data.rosterBatchId !== existing.rosterBatchId;
      const questionSetsChanged =
        parsed.data.questionBatchId !== undefined &&
        parsed.data.questionBatchId !== existing.questionBatchId;
      const fillInBatchChanged =
        parsed.data.fillInBatchId !== undefined &&
        parsed.data.fillInBatchId !== existing.fillInBatchId;
      const modulesChanged =
        parsed.data.contentModules !== undefined &&
        JSON.stringify(parsed.data.contentModules) !==
          JSON.stringify(existing.contentModules);

      await prisma.$transaction(
        async (tx) => {
          await tx.exam.update({
            where: { id },
            data: {
              ...(parsed.data.title !== undefined
                ? { title: parsed.data.title }
                : {}),
              ...(parsed.data.contentModules !== undefined
                ? { contentModules: parsed.data.contentModules }
                : {}),
              ...(parsed.data.questionBatchId !== undefined
                ? { questionBatchId: parsed.data.questionBatchId }
                : {}),
              ...(parsed.data.fillInBatchId !== undefined
                ? { fillInBatchId: parsed.data.fillInBatchId }
                : {}),
              ...(parsed.data.practicalBatchId !== undefined
                ? { practicalBatchId: parsed.data.practicalBatchId }
                : {}),
              ...(parsed.data.rosterBatchId !== undefined
                ? { rosterBatchId: parsed.data.rosterBatchId }
                : {}),
              ...(parsed.data.scheduledStartAt !== undefined
                ? { scheduledStartAt: nextScheduledStartAt }
                : {}),
              ...(parsed.data.scheduledEndAt !== undefined
                ? { scheduledEndAt: nextScheduledEndAt }
                : {}),
            },
          });

          if (
            questionSetsChanged ||
            fillInBatchChanged ||
            modulesChanged
          ) {
            if (needsQuestionMaterialize(nextModules)) {
              await materializeExamQuestionSets(tx, id, {
                questionBatchId: hasContentModule(nextModules, 'OBJECTIVE')
                  ? nextQuestionBatchId
                  : null,
                fillInBatchId: hasContentModule(nextModules, 'FILL')
                  ? nextFillInBatchId
                  : null,
              });
            } else {
              await tx.examQuestion.deleteMany({ where: { examId: id } });
            }
          }

          if (rosterBatchChanged) {
            await assignExamSeats(tx, id, nextRosterBatchId, 'random_shuffle_v1', {
              force: true,
            });
          }
        },
        { timeout: 30_000 },
      );

      if (questionSetsChanged || fillInBatchChanged || modulesChanged) {
        invalidateExamPaperCache(id);
      }

      return reply.send({ ok: true });
    },
  );
}

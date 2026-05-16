import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { getSessionRosterEntryId } from '../../../lib/student-auth.js';
import { prisma } from '../../../lib/prisma.js';
import { requireStudentSession } from '../../../plugins/student-guard.js';

const answerItemSchema = z.object({
  examQuestionId: z.string().min(1),
  selectedKeys: z.string().max(64),
});

const putBodySchema = z.object({
  examId: z.string().min(1),
  answers: z.array(answerItemSchema).min(1).max(500),
});

export async function registerStudentExamAnswersRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.put(
    '/api/student/exam/answers',
    {
      preHandler: requireStudentSession,
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const rosterEntryId = getSessionRosterEntryId(request);
      if (!rosterEntryId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parsed = putBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId, answers } = parsed.data;

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

      const questionCount = await prisma.examQuestion.count({
        where: { examId },
      });
      if (answers.length > questionCount) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const existingSubmission = await prisma.submission.findUnique({
        where: {
          examId_rosterEntryId: { examId, rosterEntryId },
        },
        select: { id: true },
      });

      if (existingSubmission) {
        return reply.status(409).send({
          code: 'ALREADY_SUBMITTED',
          message: '试卷已提交，无法修改作答',
        });
      }

      const examQuestionIds = [
        ...new Set(answers.map((a) => a.examQuestionId)),
      ];

      const validQuestions = await prisma.examQuestion.findMany({
        where: {
          examId,
          id: { in: examQuestionIds },
        },
        select: { id: true },
      });

      if (validQuestions.length !== examQuestionIds.length) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      await prisma.$transaction(async (tx) => {
        for (const examQuestionId of examQuestionIds) {
          const item = answers.find(
            (a) => a.examQuestionId === examQuestionId,
          )!;
          await tx.answerDraft.upsert({
            where: {
              examId_rosterEntryId_examQuestionId: {
                examId,
                rosterEntryId,
                examQuestionId,
              },
            },
            create: {
              examId,
              rosterEntryId,
              examQuestionId,
              selectedKeys: item.selectedKeys,
            },
            update: {
              selectedKeys: item.selectedKeys,
            },
          });
        }
      });

      return reply.send({ ok: true });
    },
  );
}

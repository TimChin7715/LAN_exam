import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { prisma } from '../../../lib/prisma.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

const answerItemSchema = z.object({
  examQuestionId: z.string().min(1),
  selectedKeys: z.string().max(4096),
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
      const rosterOrReply = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterOrReply !== 'string') {
        return rosterOrReply;
      }
      const rosterEntryId = rosterOrReply;

      const parsed = putBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId, answers } = parsed.data;
      const normalizedAnswers = [
        ...new Map(
          answers.map((item) => [item.examQuestionId, item.selectedKeys]),
        ).entries(),
      ].map(([examQuestionId, selectedKeys]) => ({
        examQuestionId,
        selectedKeys,
      }));

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
      if (normalizedAnswers.length > questionCount) {
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

      const examQuestionIds = normalizedAnswers.map((a) => a.examQuestionId);

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
        await tx.answerDraft.deleteMany({
          where: {
            examId,
            rosterEntryId,
            examQuestionId: { in: examQuestionIds },
          },
        });

        await tx.answerDraft.createMany({
          data: normalizedAnswers.map((item) => ({
            examId,
            rosterEntryId,
            examQuestionId: item.examQuestionId,
            selectedKeys: item.selectedKeys,
          })),
        });
      });

      return reply.send({ ok: true });
    },
  );
}

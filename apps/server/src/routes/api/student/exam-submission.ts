import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requiresQuestionSubmission } from '../../../lib/exam/content-mode.js';
import { prisma } from '../../../lib/prisma.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

const submissionQuerySchema = z.object({
  examId: z.string().min(1),
});

export async function registerStudentExamSubmissionRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/exam/submission',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterOrReply = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterOrReply !== 'string') {
        return rosterOrReply;
      }
      const rosterEntryId = rosterOrReply;

      const parsed = submissionQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId } = parsed.data;

      const entry = await prisma.rosterEntry.findUnique({
        where: { id: rosterEntryId },
        select: { id: true, batchId: true },
      });

      if (!entry) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: '当前无法参加本场考试。',
        });
      }

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: {
          id: true,
          title: true,
          rosterBatchId: true,
          contentModules: true,
          teacher: { select: { showScoreAfterSubmit: true } },
        },
      });

      if (!exam || entry.batchId !== exam.rosterBatchId) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: '当前无法参加本场考试。',
        });
      }

      const submission = requiresQuestionSubmission(exam.contentModules)
        ? await prisma.submission.findUnique({
            where: {
              examId_rosterEntryId: { examId, rosterEntryId },
            },
            include: {
              answers: {
                select: {
                  examQuestionId: true,
                  selectedKeys: true,
                  isCorrect: true,
                  pointsAwarded: true,
                },
              },
            },
          })
        : null;

      const questionsDone =
        !requiresQuestionSubmission(exam.contentModules) || Boolean(submission);

      if (!questionsDone) {
        return reply.status(404).send({
          code: 'NOT_SUBMITTED',
          message: '尚未提交试卷',
        });
      }

      const examQuestions = requiresQuestionSubmission(exam.contentModules)
        ? await prisma.examQuestion.findMany({
            where: { examId },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              sortOrder: true,
              question: {
                select: {
                  type: true,
                  stem: true,
                  points: true,
                  knowledgePoints: true,
                  explanation: true,
                  options: {
                    orderBy: { sortOrder: 'asc' },
                    select: { key: true, text: true, sortOrder: true },
                  },
                },
              },
            },
          })
        : [];

      const answerByQuestionId = new Map(
        submission?.answers.map((a) => [a.examQuestionId, a]) ?? [],
      );

      const submittedAt = submission?.submittedAt ?? new Date();

      return reply.send({
        examId,
        title: exam.title,
        contentModules: exam.contentModules,
        totalScore: submission?.totalScore ?? null,
        showScoreAfterSubmit: exam.teacher.showScoreAfterSubmit,
        submittedAt,
        items: examQuestions.map((eq) => {
          const answer = answerByQuestionId.get(eq.id);
          return {
            examQuestionId: eq.id,
            sortOrder: eq.sortOrder,
            type: eq.question.type,
            stem: eq.question.stem,
            points: eq.question.points,
            fillQuestionNo:
              eq.question.type === 'FILL' ? eq.question.knowledgePoints : null,
            fillBlankIndex:
              eq.question.type === 'FILL' ? eq.question.explanation : null,
            options: eq.question.options,
            selectedKeys: answer?.selectedKeys ?? '',
            isCorrect: answer?.isCorrect ?? false,
            pointsAwarded: answer?.pointsAwarded ?? 0,
          };
        }),
      });
    },
  );
}

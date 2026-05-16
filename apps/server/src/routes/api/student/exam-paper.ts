import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { getSessionRosterEntryId } from '../../../lib/student-auth.js';
import { prisma } from '../../../lib/prisma.js';
import { requireStudentSession } from '../../../plugins/student-guard.js';

const paperQuerySchema = z.object({
  examId: z.string().min(1),
});

export async function registerStudentExamPaperRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/exam/paper',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = getSessionRosterEntryId(request);
      if (!rosterEntryId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parsed = paperQuerySchema.safeParse(request.query);
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

      const examQuestions = await prisma.examQuestion.findMany({
        where: { examId },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          sortOrder: true,
          question: {
            select: {
              id: true,
              type: true,
              stem: true,
              points: true,
              options: {
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  key: true,
                  text: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      });

      const drafts = await prisma.answerDraft.findMany({
        where: { examId, rosterEntryId },
        select: {
          examQuestionId: true,
          selectedKeys: true,
        },
      });

      const draftByQuestionId = new Map(
        drafts.map((d) => [d.examQuestionId, d.selectedKeys]),
      );

      return reply.send({
        examId,
        items: examQuestions.map((eq) => ({
          examQuestionId: eq.id,
          sortOrder: eq.sortOrder,
          type: eq.question.type,
          stem: eq.question.stem,
          points: eq.question.points,
          options: eq.question.options,
          selectedKeys: draftByQuestionId.get(eq.id) ?? '',
        })),
      });
    },
  );
}

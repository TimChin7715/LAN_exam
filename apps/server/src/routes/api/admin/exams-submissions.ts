import type { FastifyInstance } from 'fastify';

import { getSessionTeacherId } from '../../../lib/auth.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

export async function registerAdminExamsSubmissionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/exams/:id/submissions',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: { id: true, rosterBatchId: true },
      });

      if (!exam) {
        return reply.status(404).send({
          ok: false,
          code: 'EXAM_NOT_FOUND',
          message: '考试不存在',
        });
      }

      const rosterEntries = await prisma.rosterEntry.findMany({
        where: { batchId: exam.rosterBatchId },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          nationalId: true,
          submissions: {
            where: { examId: id },
            select: {
              totalScore: true,
              submittedAt: true,
            },
            take: 1,
          },
        },
      });

      return reply.send({
        ok: true,
        items: rosterEntries.map((entry) => {
          const submission = entry.submissions[0];
          return {
            rosterEntryId: entry.id,
            fullName: entry.fullName,
            nationalId: entry.nationalId,
            totalScore: submission?.totalScore ?? null,
            submitted: Boolean(submission),
            submittedAt: submission?.submittedAt ?? null,
          };
        }),
      });
    },
  );

  app.get(
    '/api/admin/exams/:id/submissions/:rosterEntryId',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id, rosterEntryId } = request.params as {
        id: string;
        rosterEntryId: string;
      };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: { id: true, rosterBatchId: true },
      });

      if (!exam) {
        return reply.status(404).send({
          ok: false,
          code: 'EXAM_NOT_FOUND',
          message: '考试不存在',
        });
      }

      const entry = await prisma.rosterEntry.findFirst({
        where: { id: rosterEntryId, batchId: exam.rosterBatchId },
        select: { id: true, fullName: true, nationalId: true },
      });

      if (!entry) {
        return reply.status(404).send({
          ok: false,
          code: 'ROSTER_ENTRY_NOT_FOUND',
          message: '考生不存在',
        });
      }

      const submission = await prisma.submission.findUnique({
        where: {
          examId_rosterEntryId: { examId: id, rosterEntryId },
        },
        include: {
          answers: {
            include: {
              examQuestion: {
                include: {
                  question: {
                    select: {
                      type: true,
                      stem: true,
                      answerKeys: true,
                      points: true,
                      options: {
                        orderBy: { sortOrder: 'asc' },
                        select: { key: true, text: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!submission) {
        return reply.status(404).send({
          ok: false,
          code: 'NOT_SUBMITTED',
          message: '该考生尚未提交',
        });
      }

      return reply.send({
        ok: true,
        rosterEntry: entry,
        submission: {
          totalScore: submission.totalScore,
          submittedAt: submission.submittedAt,
          answers: submission.answers.map((a) => ({
            examQuestionId: a.examQuestionId,
            selectedKeys: a.selectedKeys,
            isCorrect: a.isCorrect,
            pointsAwarded: a.pointsAwarded,
            type: a.examQuestion.question.type,
            stem: a.examQuestion.question.stem,
            answerKeys: a.examQuestion.question.answerKeys,
            points: a.examQuestion.question.points,
            options: a.examQuestion.question.options,
          })),
        },
      });
    },
  );
}

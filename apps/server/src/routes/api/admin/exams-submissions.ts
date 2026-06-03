import type { FastifyInstance } from 'fastify';

import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import {
  requiresPracticalBatch,
  requiresQuestionSubmission,
} from '../../../lib/exam/content-mode.js';
import { resetStudentExamSubmission } from '../../../lib/exam/reset-student-submission.js';
import { RetakeExamError } from '../../../lib/exam/types.js';
import { prisma } from '../../../lib/prisma.js';
import {
  contentTypeForWordFilename,
  readStorageFile,
} from '../../../lib/storage/index.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

export async function registerAdminExamsSubmissionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/exams/:id/submissions',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const { id } = request.params as { id: string };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: { id: true, status: true, rosterBatchId: true, contentModules: true },
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
          organization: true,
          nationalId: true,
          submissions: {
            where: { examId: id },
            select: {
              totalScore: true,
              submittedAt: true,
              answers: {
                select: { selectedKeys: true },
              },
            },
            take: 1,
          },
          practicalSubmissions: {
            where: { examId: id },
            select: { submittedAt: true },
            take: 1,
          },
        },
      });

      return reply.send({
        ok: true,
        contentModules: exam.contentModules,
        items: rosterEntries.map((entry) => {
          const submission = entry.submissions[0];
          const practical = entry.practicalSubmissions[0];
          const hasAnyQuestionAnswer = Boolean(
            submission?.answers.some((a) => a.selectedKeys.trim().length > 0),
          );
          const questionsDone =
            !requiresQuestionSubmission(exam.contentModules) ||
            Boolean(submission);
          const practicalDone =
            !requiresPracticalBatch(exam.contentModules) || Boolean(practical);
          const submitted = questionsDone && practicalDone;
          const absent =
            exam.status === 'ENDED' && !hasAnyQuestionAnswer && !Boolean(practical);
          const statusLabel: 'submitted' | 'pending' | 'absent' = absent
            ? 'absent'
            : submitted
              ? 'submitted'
              : 'pending';
          return {
            rosterEntryId: entry.id,
            fullName: entry.fullName,
            organization: entry.organization,
            nationalId: entry.nationalId,
            totalScore: submission?.totalScore ?? null,
            submitted,
            statusLabel,
            submittedAt:
              submission?.submittedAt ?? practical?.submittedAt ?? null,
            practicalSubmitted: practicalDone,
            practicalSubmittedAt: practical?.submittedAt ?? null,
          };
        }),
      });
    },
  );

  app.get(
    '/api/admin/exams/:id/submissions/:rosterEntryId',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const { id, rosterEntryId } = request.params as {
        id: string;
        rosterEntryId: string;
      };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: { id: true, rosterBatchId: true, contentModules: true },
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

      const submission = requiresQuestionSubmission(exam.contentModules)
        ? await prisma.submission.findUnique({
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
          })
        : null;

      if (requiresQuestionSubmission(exam.contentModules) && !submission) {
        return reply.status(404).send({
          ok: false,
          code: 'NOT_SUBMITTED',
          message: '该考生尚未提交试题',
        });
      }

      return reply.send({
        ok: true,
        rosterEntry: entry,
        submission: submission
          ? {
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
            }
          : null,
      });
    },
  );

  app.get(
    '/api/admin/exams/:id/submissions/:rosterEntryId/practical-answer',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const { id, rosterEntryId } = request.params as {
        id: string;
        rosterEntryId: string;
      };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: { id: true, rosterBatchId: true, contentModules: true },
      });

      if (!exam) {
        return reply.status(404).send({
          ok: false,
          code: 'EXAM_NOT_FOUND',
          message: '考试不存在',
        });
      }

      if (!requiresPracticalBatch(exam.contentModules)) {
        return reply.status(404).send({
          ok: false,
          code: 'NO_PRACTICAL',
          message: '本场考试不含操作题',
        });
      }

      const entry = await prisma.rosterEntry.findFirst({
        where: { id: rosterEntryId, batchId: exam.rosterBatchId },
        select: { id: true },
      });

      if (!entry) {
        return reply.status(404).send({
          ok: false,
          code: 'ROSTER_ENTRY_NOT_FOUND',
          message: '考生不存在',
        });
      }

      const practical = await prisma.practicalSubmission.findUnique({
        where: { examId_rosterEntryId: { examId: id, rosterEntryId } },
      });

      if (!practical) {
        return reply.status(404).send({
          ok: false,
          code: 'NOT_SUBMITTED',
          message: '该考生尚未提交操作题作答',
        });
      }

      const buffer = await readStorageFile(practical.docxStorageKey);
      return reply
        .header(
          'Content-Type',
          contentTypeForWordFilename(practical.docxFileName),
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(practical.docxFileName)}`,
        )
        .send(buffer);
    },
  );

  app.post(
    '/api/admin/exams/:id/submissions/:rosterEntryId/retake',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const { id, rosterEntryId } = request.params as {
        id: string;
        rosterEntryId: string;
      };

      try {
        await resetStudentExamSubmission({
          examId: id,
          rosterEntryId,
          teacherId,
        });
        return reply.send({ ok: true });
      } catch (err) {
        if (err instanceof RetakeExamError) {
          return reply.status(err.statusCode).send({
            ok: false,
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
}

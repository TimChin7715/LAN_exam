import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import {
  hasContentModule,
  requiresFillInBatch,
  requiresPracticalBatch,
} from '../../../lib/exam/content-mode.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { safeFillInAttachmentsZipFilename } from '../../../lib/fillin/build-attachments-zip.js';
import { listFillInBatchAttachments } from '../../../lib/fillin/load-batch-attachments.js';
import { prisma } from '../../../lib/prisma.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

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
      const rosterOrReply = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterOrReply !== 'string') {
        return rosterOrReply;
      }
      const rosterEntryId = rosterOrReply;

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

      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: {
          contentModules: true,
          fillInBatch: {
            select: {
              id: true,
              title: true,
              wordFileName: true,
              excelFileName: true,
            },
          },
          practicalBatch: {
            select: {
              title: true,
              wordFileName: true,
              excelFileName: true,
            },
          },
        },
      });

      if (!exam) {
        return reply.status(404).send({
          code: 'EXAM_NOT_FOUND',
          message: '考试不存在',
        });
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
              knowledgePoints: true,
              explanation: true,
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

      let practical: {
        batchTitle: string;
        wordFileName: string;
        excelFileName: string;
        hasAnswerDraft: boolean;
        answerFileName: string | null;
        answerUpdatedAt: string | null;
      } | null = null;

      if (requiresPracticalBatch(exam.contentModules) && exam.practicalBatch) {
        const practicalDraft = await prisma.practicalAnswerDraft.findUnique({
          where: { examId_rosterEntryId: { examId, rosterEntryId } },
          select: { docxFileName: true, updatedAt: true },
        });
        practical = {
          batchTitle: exam.practicalBatch.title,
          wordFileName: exam.practicalBatch.wordFileName,
          excelFileName: exam.practicalBatch.excelFileName,
          hasAnswerDraft: Boolean(practicalDraft),
          answerFileName: practicalDraft?.docxFileName ?? null,
          answerUpdatedAt: practicalDraft?.updatedAt.toISOString() ?? null,
        };
      }

      let fillIn: {
        batchTitle: string;
        wordFileName: string;
        excelFileName: string;
        hasAttachments: boolean;
        attachmentZipFileName: string | null;
      } | null = null;

      if (requiresFillInBatch(exam.contentModules) && exam.fillInBatch) {
        const batchAttachments = await listFillInBatchAttachments(
          prisma,
          exam.fillInBatch.id,
        );
        fillIn = {
          batchTitle: exam.fillInBatch.title,
          wordFileName: exam.fillInBatch.wordFileName,
          excelFileName: exam.fillInBatch.excelFileName,
          hasAttachments: batchAttachments.length > 0,
          attachmentZipFileName:
            batchAttachments.length > 0
              ? safeFillInAttachmentsZipFilename(exam.fillInBatch.title)
              : null,
        };
      }

      return reply.send({
        examId,
        contentModules: exam.contentModules,
        items: examQuestions.map((eq) => ({
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
          selectedKeys: draftByQuestionId.get(eq.id) ?? '',
        })),
        practical,
        fillIn,
      });
    },
  );
}

import type { FastifyInstance } from 'fastify';

import { FILL_MODULE_LABEL_ZH } from '../../../lib/exam/content-labels.js';
import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { requiresFillInBatch } from '../../../lib/exam/content-mode.js';
import {
  streamFillInScreenshotsZip,
  type FillInScreenshotZipEntry,
} from '../../../lib/fillin/build-screenshots-zip.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

function safeZipFilename(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'exam';
  return `${base}-${FILL_MODULE_LABEL_ZH}截图.zip`;
}

export async function registerAdminExamsExportFillInScreenshotsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/exams/:id/export-fillin-screenshots',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: { id: true, title: true, contentModules: true },
      });

      if (!exam) {
        return reply.status(404).send({
          ok: false,
          code: 'EXAM_NOT_FOUND',
          message: '考试不存在',
        });
      }

      if (!requiresFillInBatch(exam.contentModules)) {
        return reply.status(400).send({
          ok: false,
          code: 'NO_FILL_IN',
          message: `本场考试不含${FILL_MODULE_LABEL_ZH}`,
        });
      }

      const submissions = await prisma.submission.findMany({
        where: { examId: id },
        select: {
          id: true,
          rosterEntry: {
            select: { fullName: true, nationalId: true },
          },
          fillInScreenshots: {
            orderBy: [{ examQuestionId: 'asc' }, { sortOrder: 'asc' }],
            select: {
              sortOrder: true,
              storageKey: true,
              mimeType: true,
              examQuestionId: true,
            },
          },
        },
      });

      const questionNoByExamQuestionId = new Map<string, string>();
      const examQuestions = await prisma.examQuestion.findMany({
        where: { examId: id },
        include: { question: { select: { type: true, knowledgePoints: true } } },
      });
      for (const eq of examQuestions) {
        if (eq.question.type === 'FILL') {
          questionNoByExamQuestionId.set(
            eq.id,
            eq.question.knowledgePoints?.trim() || '0',
          );
        }
      }

      const rows: FillInScreenshotZipEntry[] = [];
      for (const sub of submissions) {
        for (const shot of sub.fillInScreenshots) {
          rows.push({
            fullName: sub.rosterEntry.fullName,
            nationalId: sub.rosterEntry.nationalId,
            questionNo:
              questionNoByExamQuestionId.get(shot.examQuestionId) ?? '0',
            sortOrder: shot.sortOrder,
            storageKey: shot.storageKey,
            mimeType: shot.mimeType,
          });
        }
      }

      if (rows.length === 0) {
        return reply.status(404).send({
          ok: false,
          code: 'NO_SCREENSHOTS',
          message: `暂无已交卷学员的${FILL_MODULE_LABEL_ZH}截图`,
        });
      }

      const filename = safeZipFilename(exam.title);
      const encoded = encodeURIComponent(filename);
      const stream = await streamFillInScreenshotsZip(rows);

      return reply
        .header('Content-Type', 'application/zip')
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encoded}`,
        )
        .send(stream);
    },
  );
}

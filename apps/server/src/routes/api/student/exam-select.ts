import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { listRosterInProgressExams } from '../../../lib/exam/list-roster-in-progress-exams.js';
import { prisma } from '../../../lib/prisma.js';
import {
  ensureStudentRosterEntryId,
  getSessionStudentExamId,
  requireStudentSession,
  setSessionStudentExamId,
} from '../../../plugins/student-guard.js';

const bodySchema = z.object({
  examId: z.string().min(1),
});

export async function registerStudentExamSelectRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/student/exam/select',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterEntryId !== 'string') return rosterEntryId;

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const entry = await prisma.rosterEntry.findUnique({
        where: { id: rosterEntryId },
        select: { batchId: true },
      });
      if (!entry) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const allowed = await listRosterInProgressExams(prisma, entry.batchId);
      const exam = allowed.find((e) => e.id === parsed.data.examId);
      if (!exam) {
        return reply.status(403).send({
          code: 'FORBIDDEN',
          message: '无法选择该场考试，请确认考试已开始且属于您的名单。',
        });
      }

      const previous = getSessionStudentExamId(request);
      await setSessionStudentExamId(request, exam.id);

      return reply.send({
        ok: true,
        examId: exam.id,
        title: exam.title,
        changed: previous !== exam.id,
      });
    },
  );
}

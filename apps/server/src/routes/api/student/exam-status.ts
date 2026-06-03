import type { FastifyInstance } from 'fastify';

import { resolveStudentInProgressExamStatus } from '../../../lib/exam/resolve-student-exam-status.js';
import { resolveStudentEndedSummary } from '../../../lib/exam/student-ended-summary.js';
import { prisma } from '../../../lib/prisma.js';
import {
  getSessionStudentExamId,
  setSessionStudentExamId,
} from '../../../lib/student-auth.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

export async function registerStudentExamStatusRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/exam/status',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterOrReply = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterOrReply !== 'string') {
        return rosterOrReply;
      }
      const rosterEntryId = rosterOrReply;

      const entry = await prisma.rosterEntry.findUnique({
        where: { id: rosterEntryId },
        select: { batchId: true },
      });

      if (!entry) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const inProgressStatus = await resolveStudentInProgressExamStatus(
        prisma,
        entry.batchId,
        getSessionStudentExamId(request),
      );

      if (inProgressStatus) {
        if (inProgressStatus.status !== 'choose_exam') {
          await setSessionStudentExamId(request, inProgressStatus.examId);
        }
        return reply.send(inProgressStatus);
      }

      const draftExam = await prisma.exam.findFirst({
        where: {
          rosterBatchId: entry.batchId,
          status: 'DRAFT',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (draftExam) {
        return reply.send({ status: 'none' as const });
      }

      const endedExam = await prisma.exam.findFirst({
        where: {
          rosterBatchId: entry.batchId,
          status: 'ENDED',
        },
        orderBy: { endedAt: 'desc' },
        select: { id: true },
      });

      if (!endedExam) {
        return reply.send({ status: 'none' as const });
      }

      const summary = await resolveStudentEndedSummary(
        rosterEntryId,
        endedExam.id,
      );

      if (!summary) {
        return reply.send({ status: 'none' as const });
      }

      return reply.send({
        status: 'ENDED' as const,
        ...summary,
      });
    },
  );
}

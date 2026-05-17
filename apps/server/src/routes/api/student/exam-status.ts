import type { FastifyInstance } from 'fastify';

import { prisma } from '../../../lib/prisma.js';
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

      const exam = await prisma.exam.findFirst({
        where: {
          status: 'IN_PROGRESS',
          rosterBatchId: entry.batchId,
        },
        select: {
          id: true,
          title: true,
        },
      });

      if (!exam) {
        return reply.send({ status: 'none' as const });
      }

      return reply.send({
        status: 'IN_PROGRESS' as const,
        examId: exam.id,
        title: exam.title,
      });
    },
  );
}

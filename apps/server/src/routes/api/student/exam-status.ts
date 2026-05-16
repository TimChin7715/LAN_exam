import type { FastifyInstance } from 'fastify';

import { getSessionRosterEntryId } from '../../../lib/student-auth.js';
import { prisma } from '../../../lib/prisma.js';
import { requireStudentSession } from '../../../plugins/student-guard.js';

export async function registerStudentExamStatusRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/exam/status',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = getSessionRosterEntryId(request);
      if (!rosterEntryId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

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

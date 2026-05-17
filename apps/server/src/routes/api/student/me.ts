import type { FastifyInstance } from 'fastify';

import { prisma } from '../../../lib/prisma.js';
import { replyUnauthorized } from '../../../lib/reply.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

export async function registerStudentMeRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/me',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterOrReply = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterOrReply !== 'string') {
        return rosterOrReply;
      }
      const rosterEntryId = rosterOrReply;

      const entry = await prisma.rosterEntry.findUnique({
        where: { id: rosterEntryId },
      });

      if (!entry) {
        return await replyUnauthorized(reply);
      }

      return reply.send({
        fullName: entry.fullName,
        nationalId: entry.nationalId,
      });
    },
  );
}

import type { FastifyInstance } from 'fastify';

import { prisma } from '../../../lib/prisma.js';
import { requireStudentSession } from '../../../plugins/student-guard.js';
import { getSessionRosterEntryId } from '../../../lib/student-auth.js';

export async function registerStudentMeRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/me',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterEntryId = getSessionRosterEntryId(request);
      if (!rosterEntryId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const entry = await prisma.rosterEntry.findUnique({
        where: { id: rosterEntryId },
      });

      if (!entry) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      return reply.send({
        fullName: entry.fullName,
        nationalId: entry.nationalId,
      });
    },
  );
}

import type { FastifyReply, FastifyRequest } from 'fastify';

import { getSessionRosterEntryId } from '../lib/student-auth.js';

export async function requireStudentSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const rosterEntryId = getSessionRosterEntryId(request);
  if (!rosterEntryId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

import type { FastifyReply, FastifyRequest } from 'fastify';

import { getSessionRosterEntryId } from '../lib/student-auth.js';
import { isReplyFinished, replyUnauthorized } from '../lib/reply.js';

/**
 * Resolve roster entry id for a student route, or send/return 401.
 * Route handlers must use this instead of `getSessionRosterEntryId(request)!`
 * because preHandler may have already sent 401 while Fastify still invokes the handler.
 */
export async function ensureStudentRosterEntryId(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<string | FastifyReply> {
  if (isReplyFinished(reply)) {
    return reply;
  }
  const rosterEntryId = getSessionRosterEntryId(request);
  if (!rosterEntryId) {
    return replyUnauthorized(reply);
  }
  return rosterEntryId;
}

export async function requireStudentSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await ensureStudentRosterEntryId(request, reply);
}

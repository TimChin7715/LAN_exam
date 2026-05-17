import type { FastifyReply } from 'fastify';

/** True when a response was already committed (Fastify or raw Node). */
export function isReplyFinished(reply: FastifyReply): boolean {
  return reply.sent || reply.raw.headersSent;
}

/** Send 401 and halt the hook/route chain (return value must be returned from preHandler). */
export async function replyUnauthorized(
  reply: FastifyReply,
): Promise<FastifyReply> {
  if (isReplyFinished(reply)) {
    return reply;
  }
  return reply.status(401).send({ error: 'Unauthorized' });
}

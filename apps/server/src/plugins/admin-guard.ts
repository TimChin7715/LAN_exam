import type { FastifyReply, FastifyRequest } from 'fastify';

import { isAdminAuthDisabled } from '../lib/admin-context.js';
import { getSessionTeacherId, loadSessionUser } from '../lib/auth.js';
import { isReplyFinished, replyUnauthorized } from '../lib/reply.js';
import { getRequestSession } from '../lib/session.js';

export async function requireAdminSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isAdminAuthDisabled()) {
    return;
  }

  const teacherId = getSessionTeacherId(request);
  if (!teacherId) {
    return await replyUnauthorized(reply);
  }

  const user = await loadSessionUser(request);
  if (!user) {
    getRequestSession(request)?.destroy(() => {});
    return await replyUnauthorized(reply);
  }

  if (user.mustChangePassword) {
    if (isReplyFinished(reply)) {
      return reply;
    }
    return reply.status(403).send({
      error: 'Password change required',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
}

import type { FastifyReply, FastifyRequest } from 'fastify';

import { getSessionTeacherId, loadSessionUser } from '../lib/auth.js';

export async function requireAdminSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const teacherId = getSessionTeacherId(request);
  if (!teacherId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  const user = await loadSessionUser(request);
  if (!user) {
    request.session.destroy(() => {});
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  if (user.mustChangePassword) {
    return reply.status(401).send({
      error: 'Password change required',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
}

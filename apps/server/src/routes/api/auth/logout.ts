import type { FastifyInstance } from 'fastify';

import { getRequestSession } from '../../../lib/session.js';

function destroySession(
  request: import('fastify').FastifyRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = getRequestSession(request);
    if (!session) {
      resolve();
      return;
    }
    session.destroy((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export async function registerAuthLogoutRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post('/api/auth/logout', async (request, reply) => {
    await destroySession(request);
    return reply.send({ ok: true });
  });
}

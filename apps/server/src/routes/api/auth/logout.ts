import type { FastifyInstance } from 'fastify';

function destroySession(
  request: import('fastify').FastifyRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = request.session;
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

import type { FastifyInstance } from 'fastify';

import { loadSessionUser } from '../../../lib/auth.js';

export async function registerAuthMeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/me', async (request, reply) => {
    const user = await loadSessionUser(request);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return reply.send(user);
  });
}

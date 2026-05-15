import type { FastifyInstance } from 'fastify';

import { requireAdminSession } from '../../../plugins/admin-guard.js';

export async function registerAdminPingRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/ping',
    { preHandler: requireAdminSession },
    async (_request, reply) => {
      return reply.send({ ok: true });
    },
  );
}

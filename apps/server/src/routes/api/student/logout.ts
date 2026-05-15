import type { FastifyInstance } from 'fastify';

import { destroyStudentSession } from '../../../lib/student-auth.js';

export async function registerStudentLogoutRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post('/api/student/logout', async (request, reply) => {
    await destroyStudentSession(request);
    return reply.send({ ok: true });
  });
}

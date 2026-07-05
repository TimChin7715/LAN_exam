import type { FastifyInstance } from 'fastify';

import { resolveStudentShowSeatBoard } from '../../../lib/admin-settings.js';
import { prisma } from '../../../lib/prisma.js';

export async function registerStudentConfigRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/config',
    {
      config: {
        rateLimit: {
          max: Number(process.env.STUDENT_SEAT_BOARD_RATE_LIMIT_MAX ?? 60),
          timeWindow: '1 minute',
        },
      },
    },
    async (_request, reply) => {
      const showSeatBoard = await resolveStudentShowSeatBoard(prisma);

      return reply.send({ ok: true, showSeatBoard });
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().optional(),
});

export async function registerAdminRosterListRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/roster',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
        });
      }

      const { page, pageSize, query } = parsed.data;
      const q = query?.trim();
      const where = q
        ? {
            OR: [
              { fullName: { contains: q } },
              { nationalId: { contains: q } },
            ],
          }
        : {};

      const [total, items] = await Promise.all([
        prisma.rosterEntry.count({ where }),
        prisma.rosterEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            fullName: true,
            nationalId: true,
            createdAt: true,
          },
        }),
      ]);

      return reply.send({
        ok: true,
        page,
        pageSize,
        total,
        items,
      });
    },
  );
}

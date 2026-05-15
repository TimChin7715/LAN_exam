import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['SINGLE', 'MULTI', 'JUDGE']).optional(),
  batchId: z.string().min(1).optional(),
});

export async function registerAdminQuestionsListRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/questions',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
        });
      }

      const { page, pageSize, type, batchId } = parsed.data;
      const where = {
        ...(type ? { type } : {}),
        ...(batchId ? { batchId } : {}),
      };

      const [total, items] = await Promise.all([
        prisma.question.count({ where }),
        prisma.question.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            type: true,
            stem: true,
            answerKeys: true,
            points: true,
            difficulty: true,
            batchId: true,
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

  app.get(
    '/api/admin/questions/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const question = await prisma.question.findUnique({
        where: { id },
        include: {
          options: { orderBy: { sortOrder: 'asc' } },
          batch: {
            select: {
              id: true,
              fileName: true,
              createdAt: true,
            },
          },
        },
      });

      if (!question) {
        return reply.status(404).send({
          error: 'Not found',
          code: 'QUESTION_NOT_FOUND',
        });
      }

      return reply.send({ ok: true, question });
    },
  );
}

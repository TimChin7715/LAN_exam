import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  CLEAR_ALL_DATA_CONFIRM_PHRASE,
  clearAllTeacherData,
} from '../../../lib/admin/clear-teacher-data.js';
import { getAppVersion } from '../../../lib/app-version.js';
import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const patchBodySchema = z.object({
  showSeatBoard: z.boolean(),
  showScoreAfterSubmit: z.boolean(),
});

const clearAllDataBodySchema = z.object({
  confirmPhrase: z.literal(CLEAR_ALL_DATA_CONFIRM_PHRASE),
});

export async function registerAdminSettingsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/settings',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { showSeatBoard: true, showScoreAfterSubmit: true },
      });

      if (!teacher) {
        return reply.status(404).send({
          error: 'Not found',
          code: 'TEACHER_NOT_FOUND',
        });
      }

      return reply.send({
        ok: true,
        showSeatBoard: teacher.showSeatBoard,
        showScoreAfterSubmit: teacher.showScoreAfterSubmit,
        appVersion: getAppVersion(),
      });
    },
  );

  app.patch(
    '/api/admin/settings',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const parsed = patchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten(),
        });
      }

      const teacher = await prisma.teacher.update({
        where: { id: teacherId },
        data: {
          showSeatBoard: parsed.data.showSeatBoard,
          showScoreAfterSubmit: parsed.data.showScoreAfterSubmit,
        },
        select: { showSeatBoard: true, showScoreAfterSubmit: true },
      });

      return reply.send({
        ok: true,
        showSeatBoard: teacher.showSeatBoard,
        showScoreAfterSubmit: teacher.showScoreAfterSubmit,
      });
    },
  );

  app.post(
    '/api/admin/settings/clear-all-data',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const parsed = clearAllDataBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          message: `请在请求中提供确认短语「${CLEAR_ALL_DATA_CONFIRM_PHRASE}」。`,
          details: parsed.error.flatten(),
        });
      }

      const deleted = await clearAllTeacherData(prisma, teacherId);

      return reply.send({ ok: true, deleted });
    },
  );
}

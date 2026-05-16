import type { FastifyInstance } from 'fastify';

import { getSessionTeacherId } from '../../../lib/auth.js';
import { endExam, startExam } from '../../../lib/exam/transition.js';
import {
  ExamTransitionError,
} from '../../../lib/exam/types.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

export async function registerAdminExamsLifecycleRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/admin/exams/:id/start',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };

      try {
        const exam = await startExam(id, teacherId);
        return reply.send({
          ok: true,
          exam: {
            id: exam.id,
            status: exam.status,
            startedAt: exam.startedAt,
          },
        });
      } catch (err) {
        if (err instanceof ExamTransitionError) {
          return reply.status(err.statusCode).send({
            ok: false,
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  app.post(
    '/api/admin/exams/:id/end',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as { id: string };

      try {
        const exam = await endExam(id, teacherId);
        return reply.send({
          ok: true,
          exam: {
            id: exam.id,
            status: exam.status,
            endedAt: exam.endedAt,
          },
        });
      } catch (err) {
        if (err instanceof ExamTransitionError) {
          return reply.status(err.statusCode).send({
            ok: false,
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
}

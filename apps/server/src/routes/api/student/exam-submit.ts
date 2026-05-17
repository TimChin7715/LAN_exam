import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { submitExam } from '../../../lib/exam/submit.js';
import { SubmitExamError } from '../../../lib/exam/types.js';
import { prisma } from '../../../lib/prisma.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

const submitBodySchema = z.object({
  examId: z.string().min(1),
});

export async function registerStudentExamSubmitRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/student/exam/submit',
    {
      preHandler: requireStudentSession,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const rosterOrReply = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterOrReply !== 'string') {
        return rosterOrReply;
      }
      const rosterEntryId = rosterOrReply;

      const parsed = submitBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      try {
        const result = await submitExam(prisma, {
          examId: parsed.data.examId,
          rosterEntryId,
        });
        return reply.send({
          ok: true,
          totalScore: result.totalScore,
          submittedAt: result.submittedAt,
        });
      } catch (err) {
        if (err instanceof SubmitExamError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
}

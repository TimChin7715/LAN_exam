import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { examSubmitGate } from '../../../lib/concurrency/gates.js';
import { ServerBusyError } from '../../../lib/concurrency/server-busy-error.js';
import { submitExam, type SubmitMode } from '../../../lib/exam/submit.js';
import { prisma } from '../../../lib/prisma.js';
import { SubmitExamError } from '../../../lib/exam/types.js';
import { SERVER_BUSY_CODE, SERVER_BUSY_MESSAGE } from '../../../lib/errors.js';
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
        const examRow = await prisma.exam.findUnique({
          where: { id: parsed.data.examId },
          select: { scheduledEndAt: true, status: true },
        });
        const now = new Date();
        const mode: SubmitMode =
          examRow?.status === 'IN_PROGRESS' &&
          examRow.scheduledEndAt &&
          now > examRow.scheduledEndAt
            ? 'deadline'
            : 'strict';

        const result = await examSubmitGate.run(() =>
          submitExam({
            examId: parsed.data.examId,
            rosterEntryId,
            mode,
          }),
        );
        return reply.send({
          ok: true,
          totalScore: result.totalScore,
          submittedAt: result.submittedAt,
        });
      } catch (err) {
        if (err instanceof ServerBusyError) {
          return reply
            .status(503)
            .header('Retry-After', '5')
            .send({
              code: SERVER_BUSY_CODE,
              message: SERVER_BUSY_MESSAGE,
            });
        }
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

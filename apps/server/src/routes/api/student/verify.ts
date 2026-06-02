import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  INVALID_STUDENT_CREDENTIALS_CODE,
  STUDENT_AUTH_ERROR_MESSAGE,
} from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { validateRosterNationalId } from '../../../lib/roster/national-id.js';
import { MAX_NATIONAL_ID_LENGTH } from '../../../lib/roster/types.js';
import { establishStudentSession } from '../../../lib/student-auth.js';

const verifyBodySchema = z.object({
  fullName: z.string().trim().min(1).max(64),
  nationalId: z.string().trim().min(1).max(MAX_NATIONAL_ID_LENGTH),
});

export async function registerStudentVerifyRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/student/verify',
    {
      config: {
        rateLimit: {
          max: Number(process.env.STUDENT_VERIFY_RATE_LIMIT_MAX ?? 20),
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = verifyBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { fullName, nationalId } = parsed.data;

      const nationalIdError = validateRosterNationalId(nationalId);
      if (nationalIdError) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: nationalIdError,
        });
      }

      const matches = await prisma.rosterEntry.findMany({
        where: { fullName, nationalId },
        select: { id: true, fullName: true, batchId: true },
        orderBy: { createdAt: 'desc' },
      });

      let entry = matches[0] ?? null;
      if (matches.length > 1) {
        const activeExam = await prisma.exam.findFirst({
          where: { status: 'IN_PROGRESS' },
          select: { rosterBatchId: true },
        });
        if (activeExam) {
          const inActiveBatch = matches.find(
            (m) => m.batchId === activeExam.rosterBatchId,
          );
          if (inActiveBatch) entry = inActiveBatch;
        }
      }

      if (!entry) {
        request.log.warn(
          { event: 'student_verify_failed' },
          'Student verify failed',
        );
        return reply.status(401).send({
          code: INVALID_STUDENT_CREDENTIALS_CODE,
          message: STUDENT_AUTH_ERROR_MESSAGE,
        });
      }

      await establishStudentSession(request, entry.id, entry.fullName);

      request.log.info(
        {
          event: 'student_verify_success',
          rosterEntryId: entry.id,
        },
        'Student verify succeeded',
      );

      return reply.send({ ok: true });
    },
  );
}

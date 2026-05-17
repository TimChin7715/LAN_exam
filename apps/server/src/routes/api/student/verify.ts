import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  INVALID_STUDENT_CREDENTIALS_CODE,
  STUDENT_AUTH_ERROR_MESSAGE,
  STUDENT_ID_FORMAT_ERROR_MESSAGE,
} from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { isValidNationalIdFormat } from '../../../lib/roster/national-id.js';
import { establishStudentSession } from '../../../lib/student-auth.js';

const verifyBodySchema = z.object({
  fullName: z.string().trim().min(1).max(64),
  nationalId: z.string().trim().min(1).max(18),
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

      if (!isValidNationalIdFormat(nationalId)) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: STUDENT_ID_FORMAT_ERROR_MESSAGE,
        });
      }

      const entry = await prisma.rosterEntry.findFirst({
        where: { fullName, nationalId },
      });

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

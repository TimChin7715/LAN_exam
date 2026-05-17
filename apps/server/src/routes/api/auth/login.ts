import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  AUTH_ERROR_MESSAGE,
  INVALID_CREDENTIALS_CODE,
} from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { getRequestSession, saveSession } from '../../../lib/session.js';

const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

function regenerateSession(
  request: import('fastify').FastifyRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = getRequestSession(request);
    if (!session) {
      reject(new Error('Session middleware not available'));
      return;
    }
    session.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export async function registerAuthLoginRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 15),
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
        });
      }

      const { username, password } = parsed.data;

      const teacher = await prisma.teacher.findUnique({
        where: { username },
      });

      const invalid =
        !teacher ||
        !(await argon2.verify(teacher.passwordHash, password).catch(() => false));

      if (invalid) {
        request.log.warn(
          {
            event: 'auth_login_failed',
            username,
          },
          'Login failed',
        );
        return reply.status(401).send({
          code: INVALID_CREDENTIALS_CODE,
          message: AUTH_ERROR_MESSAGE,
        });
      }

      await regenerateSession(request);
      const session = getRequestSession(request);
      if (!session) {
        throw new Error('Session middleware not available');
      }
      session.teacherId = teacher.id;
      delete session.studentRosterEntryId;
      delete session.studentName;
      await saveSession(session);

      request.log.info(
        {
          event: 'auth_login_success',
          teacherId: teacher.id,
          username: teacher.username,
        },
        'Login succeeded',
      );

      return reply.send({
        username: teacher.username,
        displayName: teacher.displayName,
        mustChangePassword: teacher.mustChangePassword,
      });
    },
  );
}

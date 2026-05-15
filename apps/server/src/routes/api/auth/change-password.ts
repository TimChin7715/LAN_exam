import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { getSessionTeacherId } from '../../../lib/auth.js';
import {
  CURRENT_PASSWORD_WRONG_CODE,
  CURRENT_PASSWORD_WRONG_MESSAGE,
} from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

export async function registerAuthChangePasswordRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post('/api/auth/change-password', async (request, reply) => {
    const teacherId = getSessionTeacherId(request);
    if (!teacherId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = changePasswordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
      });
    }

    const { currentPassword, newPassword } = parsed.data;

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const currentValid = await argon2
      .verify(teacher.passwordHash, currentPassword)
      .catch(() => false);

    if (!currentValid) {
      return reply.status(400).send({
        code: CURRENT_PASSWORD_WRONG_CODE,
        message: CURRENT_PASSWORD_WRONG_MESSAGE,
      });
    }

    const passwordHash = await argon2.hash(newPassword);

    await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    request.log.info(
      {
        event: 'auth_password_changed',
        teacherId,
      },
      'Password changed',
    );

    return reply.send({
      username: teacher.username,
      displayName: teacher.displayName,
      mustChangePassword: false,
    });
  });
}

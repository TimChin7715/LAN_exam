import type { FastifyInstance } from 'fastify';

import { registerStudentLogoutRoutes } from './logout.js';
import { registerStudentMeRoutes } from './me.js';
import { registerStudentVerifyRoutes } from './verify.js';

export async function registerStudentRoutes(
  app: FastifyInstance,
): Promise<void> {
  await registerStudentVerifyRoutes(app);
  await registerStudentMeRoutes(app);
  await registerStudentLogoutRoutes(app);
}

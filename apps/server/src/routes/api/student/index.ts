import type { FastifyInstance } from 'fastify';

import { registerStudentExamAnswersRoutes } from './exam-answers.js';
import { registerStudentExamPaperRoutes } from './exam-paper.js';
import { registerStudentExamStatusRoutes } from './exam-status.js';
import { registerStudentLogoutRoutes } from './logout.js';
import { registerStudentMeRoutes } from './me.js';
import { registerStudentVerifyRoutes } from './verify.js';

export async function registerStudentRoutes(
  app: FastifyInstance,
): Promise<void> {
  await registerStudentVerifyRoutes(app);
  await registerStudentMeRoutes(app);
  await registerStudentExamStatusRoutes(app);
  await registerStudentExamPaperRoutes(app);
  await registerStudentExamAnswersRoutes(app);
  await registerStudentLogoutRoutes(app);
}

import type { FastifyInstance } from 'fastify';

import { registerStudentExamAnswersRoutes } from './exam-answers.js';
import { registerStudentExamFillInRoutes } from './exam-fillin.js';
import { registerStudentExamFillInScreenshotRoutes } from './exam-fillin-screenshots.js';
import { registerStudentExamPaperRoutes } from './exam-paper.js';
import { registerStudentExamPracticalRoutes } from './exam-practical.js';
import { registerStudentExamStatusRoutes } from './exam-status.js';
import { registerStudentExamSubmitRoutes } from './exam-submit.js';
import { registerStudentExamSubmissionRoutes } from './exam-submission.js';
import { registerStudentLogoutRoutes } from './logout.js';
import { registerStudentMeRoutes } from './me.js';
import { registerStudentConfigRoutes } from './config.js';
import { registerStudentSeatBoardsRoutes } from './seat-boards.js';
import { registerStudentVerifyRoutes } from './verify.js';

export async function registerStudentRoutes(
  app: FastifyInstance,
): Promise<void> {
  await registerStudentConfigRoutes(app);
  await registerStudentSeatBoardsRoutes(app);
  await registerStudentVerifyRoutes(app);
  await registerStudentMeRoutes(app);
  await registerStudentExamStatusRoutes(app);
  await registerStudentExamPaperRoutes(app);
  await registerStudentExamFillInRoutes(app);
  await registerStudentExamFillInScreenshotRoutes(app);
  await registerStudentExamPracticalRoutes(app);
  await registerStudentExamAnswersRoutes(app);
  await registerStudentExamSubmitRoutes(app);
  await registerStudentExamSubmissionRoutes(app);
  await registerStudentLogoutRoutes(app);
}

import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { getApiPort } from './lib/env.js';
import { prisma } from './lib/prisma.js';
import { sessionPlugin } from './plugins/session.js';
import { registerAdminQuestionsImportRoutes } from './routes/api/admin/questions-import.js';
import { registerAdminQuestionsListRoutes } from './routes/api/admin/questions-list.js';
import { registerAdminQuestionsTemplateRoutes } from './routes/api/admin/questions-template.js';
import { registerAdminRosterImportRoutes } from './routes/api/admin/roster-import.js';
import { registerAdminRosterListRoutes } from './routes/api/admin/roster-list.js';
import { registerAdminRosterTemplateRoutes } from './routes/api/admin/roster-template.js';
import { registerAdminExamBatchesRoutes } from './routes/api/admin/exam-batches.js';
import { registerAdminExamsCrudRoutes } from './routes/api/admin/exams-crud.js';
import { registerAdminExamsLifecycleRoutes } from './routes/api/admin/exams-lifecycle.js';
import { registerAdminExamsSubmissionsRoutes } from './routes/api/admin/exams-submissions.js';
import { registerAdminExamsExportRoutes } from './routes/api/admin/exams-export.js';
import { registerAdminPingRoutes } from './routes/api/admin/ping.js';
import { registerAuthRoutes } from './routes/api/auth/index.js';
import { registerStudentRoutes } from './routes/api/student/index.js';

const PORT = getApiPort();
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({
  logger: true,
  trustProxy: process.env.TRUST_PROXY === 'true',
});

await app.register(sessionPlugin);
await app.register(rateLimit, { global: false });
await app.register(multipart, {
  limits: { files: 1 },
});
await registerAuthRoutes(app);
await registerStudentRoutes(app);
await registerAdminPingRoutes(app);
await registerAdminQuestionsTemplateRoutes(app);
await registerAdminQuestionsImportRoutes(app);
await registerAdminQuestionsListRoutes(app);
await registerAdminRosterTemplateRoutes(app);
await registerAdminRosterImportRoutes(app);
await registerAdminRosterListRoutes(app);
await registerAdminExamBatchesRoutes(app);
await registerAdminExamsCrudRoutes(app);
await registerAdminExamsLifecycleRoutes(app);
await registerAdminExamsSubmissionsRoutes(app);
await registerAdminExamsExportRoutes(app);

app.get('/health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok' };
});

app.addHook('onClose', async () => {
  await prisma.$disconnect();
});

try {
  await prisma.$queryRaw`SELECT 1`;
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as NodeJS.ErrnoException).code)
      : '';
  if (code === 'EADDRINUSE') {
    app.log.error(
      `端口 ${PORT} 已被占用，API 未能启动。请结束占用该端口的进程，或在 .env 中修改 API_PORT 后重试。`,
    );
  } else {
    app.log.error(err);
  }
  await prisma.$disconnect();
  process.exit(1);
}

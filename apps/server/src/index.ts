import { loadInstallDotenv } from './lib/load-install-env.js';

loadInstallDotenv();

import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { getAppVersion } from './lib/app-version.js';
import { getListenHost, getListenPort, shouldServeWeb } from './lib/env.js';
import { getMultipartPluginLimits } from './lib/upload-limits.js';
import { prisma } from './lib/prisma.js';
import { registerWebStatic } from './lib/web-static.js';
import { registerAdminLoopbackGuard } from './plugins/admin-loopback-guard.js';
import { sessionPlugin } from './plugins/session.js';
import { registerAdminQuestionsImportRoutes } from './routes/api/admin/questions-import.js';
import { registerAdminQuestionsListRoutes } from './routes/api/admin/questions-list.js';
import { registerAdminQuestionsTemplateRoutes } from './routes/api/admin/questions-template.js';
import { registerAdminRosterImportRoutes } from './routes/api/admin/roster-import.js';
import { registerAdminRosterListRoutes } from './routes/api/admin/roster-list.js';
import { registerAdminRosterTemplateRoutes } from './routes/api/admin/roster-template.js';
import { registerAdminRosterBatchesRoutes } from './routes/api/admin/roster-batches.js';
import { registerAdminRosterEntriesRoutes } from './routes/api/admin/roster-entries.js';
import { registerAdminQuestionBatchesRoutes } from './routes/api/admin/question-batches.js';
import { registerAdminFillInBatchesImportRoutes } from './routes/api/admin/fill-in-batches-import.js';
import { registerAdminFillInBatchesRoutes } from './routes/api/admin/fill-in-batches.js';
import { registerAdminFillInBatchesTemplateRoutes } from './routes/api/admin/fill-in-batches-template.js';
import { registerAdminPracticalBatchesImportRoutes } from './routes/api/admin/practical-batches-import.js';
import { registerAdminPracticalBatchesRoutes } from './routes/api/admin/practical-batches.js';
import { registerAdminExamSeatsRoutes } from './routes/api/admin/exam-seats.js';
import { registerAdminSettingsRoutes } from './routes/api/admin/settings.js';
import { registerAdminExamsCrudRoutes } from './routes/api/admin/exams-crud.js';
import { registerAdminExamsLifecycleRoutes } from './routes/api/admin/exams-lifecycle.js';
import { registerAdminExamsSubmissionsRoutes } from './routes/api/admin/exams-submissions.js';
import { registerAdminExamsExportRoutes } from './routes/api/admin/exams-export.js';
import { registerAdminExamsExportFillInScreenshotsRoutes } from './routes/api/admin/exams-export-fillin-screenshots.js';
import { registerAdminPingRoutes } from './routes/api/admin/ping.js';
import { registerAuthRoutes } from './routes/api/auth/index.js';
import { registerStudentRoutes } from './routes/api/student/index.js';

const PORT = getListenPort();
const HOST = getListenHost();
const serveWeb = shouldServeWeb();

const app = Fastify({
  logger: true,
  trustProxy: process.env.TRUST_PROXY === 'true',
});

await app.register(sessionPlugin);
await registerAdminLoopbackGuard(app);
await app.register(compress);
await app.register(rateLimit, { global: false });
await app.register(multipart, {
  limits: getMultipartPluginLimits(),
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
await registerAdminQuestionBatchesRoutes(app);
await registerAdminFillInBatchesTemplateRoutes(app);
await registerAdminFillInBatchesImportRoutes(app);
await registerAdminFillInBatchesRoutes(app);
await registerAdminPracticalBatchesImportRoutes(app);
await registerAdminPracticalBatchesRoutes(app);
await registerAdminRosterBatchesRoutes(app);
await registerAdminRosterEntriesRoutes(app);
await registerAdminExamsCrudRoutes(app);
await registerAdminSettingsRoutes(app);
await registerAdminExamSeatsRoutes(app);
await registerAdminExamsLifecycleRoutes(app);
await registerAdminExamsSubmissionsRoutes(app);
await registerAdminExamsExportRoutes(app);
await registerAdminExamsExportFillInScreenshotsRoutes(app);

app.get('/health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok', version: getAppVersion() };
});

if (serveWeb) {
  await registerWebStatic(app);
  app.log.info('Serving web static assets from %s', process.env.WEB_DIST_PATH ?? 'apps/web/dist');
}

app.addHook('onClose', async () => {
  await prisma.$disconnect();
});

try {
  await prisma.$queryRaw`SELECT 1`;
  await app.listen({ port: PORT, host: HOST });
  app.log.info(
    serveWeb
      ? `LAN Exam listening on http://${HOST}:${PORT} (API + web)`
      : `API listening on http://${HOST}:${PORT}`,
  );
} catch (err) {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as NodeJS.ErrnoException).code)
      : '';
  if (code === 'EADDRINUSE') {
    app.log.error(
      `端口 ${PORT} 已被占用，服务未能启动。请结束占用该端口的进程，或在 .env 中修改 WEB_PORT/API_PORT 后重试。`,
    );
  } else {
    app.log.error(err);
  }
  await prisma.$disconnect();
  process.exit(1);
}

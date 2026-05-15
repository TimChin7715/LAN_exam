import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { prisma } from './lib/prisma.js';
import { sessionPlugin } from './plugins/session.js';
import { registerAdminQuestionsImportRoutes } from './routes/api/admin/questions-import.js';
import { registerAdminQuestionsListRoutes } from './routes/api/admin/questions-list.js';
import { registerAdminQuestionsTemplateRoutes } from './routes/api/admin/questions-template.js';
import { registerAdminRosterImportRoutes } from './routes/api/admin/roster-import.js';
import { registerAdminRosterListRoutes } from './routes/api/admin/roster-list.js';
import { registerAdminRosterTemplateRoutes } from './routes/api/admin/roster-template.js';
import { registerAdminPingRoutes } from './routes/api/admin/ping.js';
import { registerAuthRoutes } from './routes/api/auth/index.js';

const PORT = Number(process.env.PORT ?? 3101);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({
  logger: true,
  trustProxy: process.env.TRUST_PROXY === 'true',
});

await app.register(sessionPlugin);
await app.register(rateLimit, { global: false });
await app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
await registerAuthRoutes(app);
await registerAdminPingRoutes(app);
await registerAdminQuestionsTemplateRoutes(app);
await registerAdminQuestionsImportRoutes(app);
await registerAdminQuestionsListRoutes(app);
await registerAdminRosterTemplateRoutes(app);
await registerAdminRosterImportRoutes(app);
await registerAdminRosterListRoutes(app);

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
  app.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
}

import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { prisma } from './lib/prisma.js';
import { sessionPlugin } from './plugins/session.js';
import { registerAdminPingRoutes } from './routes/api/admin/ping.js';
import { registerAuthRoutes } from './routes/api/auth/index.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({
  logger: true,
  trustProxy: process.env.TRUST_PROXY === 'true',
});

await app.register(sessionPlugin);
await app.register(rateLimit, { global: false });
await registerAuthRoutes(app);
await registerAdminPingRoutes(app);

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

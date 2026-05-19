import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const serverDistDir = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo layout: apps/server/dist/lib → apps/web/dist */
const defaultWebDist = path.resolve(serverDistDir, '../../../web/dist');

export function resolveWebDistRoot(): string {
  return process.env.WEB_DIST_PATH ?? defaultWebDist;
}

export async function registerWebStatic(app: FastifyInstance): Promise<void> {
  const root = resolveWebDistRoot();

  await app.register(fastifyStatic, {
    root,
    prefix: '/',
    wildcard: false,
  });

  app.setNotFoundHandler(async (request, reply) => {
    const pathname = request.url.split('?')[0] ?? request.url;
    if (pathname.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return reply.sendFile('index.html', root);
  });
}

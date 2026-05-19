import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  isAdminApiLoopbackOnly,
  isAdminAuthDisabled,
} from '../lib/admin-context.js';

function isLoopbackIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1') {
    return true;
  }
  if (ip.startsWith('::ffff:127.0.0.1')) {
    return true;
  }
  return false;
}

function pathRequiresLoopback(pathname: string): boolean {
  if (pathname.startsWith('/api/admin')) {
    return true;
  }
  if (isAdminAuthDisabled() && pathname.startsWith('/api/auth')) {
    return true;
  }
  return false;
}

async function enforceAdminLoopback(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isAdminApiLoopbackOnly()) {
    return;
  }

  const pathname = request.url.split('?')[0] ?? request.url;
  if (!pathRequiresLoopback(pathname)) {
    return;
  }

  if (!isLoopbackIp(request.ip)) {
    return reply.status(403).send({
      error: 'Forbidden',
      code: 'ADMIN_LOOPBACK_ONLY',
      message: '管理接口仅允许本机访问',
    });
  }
}

export async function registerAdminLoopbackGuard(
  app: FastifyInstance,
): Promise<void> {
  app.addHook('onRequest', enforceAdminLoopback);
}

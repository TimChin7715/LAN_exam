import type { FastifyInstance } from 'fastify';

import { registerAuthChangePasswordRoutes } from './change-password.js';
import { registerAuthLoginRoutes } from './login.js';
import { registerAuthLogoutRoutes } from './logout.js';
import { registerAuthMeRoutes } from './me.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  await registerAuthLoginRoutes(app);
  await registerAuthLogoutRoutes(app);
  await registerAuthMeRoutes(app);
  await registerAuthChangePasswordRoutes(app);
}

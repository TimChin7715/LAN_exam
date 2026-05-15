import { createReadStream } from 'node:fs';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';

import { getRepoRoot } from '../../../lib/repo-root.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const TEMPLATE_FILENAME = '名单导入模板.xlsx';
const TEMPLATE_DISPOSITION =
  "attachment; filename*=UTF-8''%E5%90%8D%E5%8D%95%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xlsx";

export async function registerAdminRosterTemplateRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/roster/template',
    { preHandler: requireAdminSession },
    async (_request, reply) => {
      const templatePath = join(
        getRepoRoot(),
        'docs/templates',
        TEMPLATE_FILENAME,
      );

      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .header('Content-Disposition', TEMPLATE_DISPOSITION)
        .send(createReadStream(templatePath));
    },
  );
}

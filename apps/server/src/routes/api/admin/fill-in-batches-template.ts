import { createReadStream } from 'node:fs';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';

import { requireAdminSession } from '../../../plugins/admin-guard.js';
import { TEMPLATES_DIR } from '../../../lib/templates-dir.js';

const TEMPLATE_FILENAME = '填空题导入模板.xlsx';
const TEMPLATE_PATH = join(TEMPLATES_DIR, TEMPLATE_FILENAME);

export async function registerAdminFillInBatchesTemplateRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/fill-in-batches/template',
    { preHandler: requireAdminSession },
    async (_request, reply) => {
      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(TEMPLATE_FILENAME)}`,
        )
        .send(createReadStream(TEMPLATE_PATH));
    },
  );
}

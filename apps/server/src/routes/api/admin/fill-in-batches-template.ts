import type { FastifyInstance } from 'fastify';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';

import { TEMPLATES_DIR } from '../../../lib/templates-dir.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const TEMPLATE_FILENAME = '操作题导入模板.docx';

export async function registerAdminFillInBatchesTemplateRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/fill-in-batches/template',
    { preHandler: requireAdminSession },
    async (_request, reply) => {
      const templatePath = join(TEMPLATES_DIR, TEMPLATE_FILENAME);
      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(TEMPLATE_FILENAME)}`,
        )
        .send(createReadStream(templatePath));
    },
  );
}

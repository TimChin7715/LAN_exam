import { createReadStream } from 'node:fs';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';

import { requireAdminSession } from '../../../plugins/admin-guard.js';
import { getRepoRoot } from '../../../lib/repo-root.js';

const TEMPLATE_FILENAME = '题库导入模板.xlsx';
const TEMPLATE_DISPOSITION =
  "attachment; filename*=UTF-8''%E9%A2%98%E5%BA%93%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xlsx";

export async function registerAdminQuestionsTemplateRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/questions/template',
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

import type { FastifyInstance } from 'fastify';

import { buildFillInImportTemplateExcel } from '../../../lib/fillin/parse-answer-sheet.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const TEMPLATE_FILENAME = '填空题导入模板.xlsx';

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
        .send(await buildFillInImportTemplateExcel());
    },
  );
}

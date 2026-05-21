import type { FastifyInstance } from 'fastify';

import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { importRoster } from '../../../lib/roster/import-roster.js';
import { parseWorkbook } from '../../../lib/roster/parse-workbook.js';
import { RosterTemplateError } from '../../../lib/roster/types.js';
import { validateRows } from '../../../lib/roster/validate-rows.js';
import { SpreadsheetReadError } from '../../../lib/spreadsheet/read-workbook.js';
import { assertValidSpreadsheetUpload } from '../../../lib/upload/spreadsheet-file.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

export async function registerAdminRosterImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/admin/roster/import',
    {
      preHandler: requireAdminSession,
      config: {
        rateLimit: {
          max: Number(process.env.ROSTER_IMPORT_RATE_LIMIT_MAX ?? 10),
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          ok: false,
          code: 'MISSING_FILE',
          message: '请上传 file 字段',
        });
      }

      const buffer = await data.toBuffer();
      const fileCheck = assertValidSpreadsheetUpload(
        data.filename,
        data.mimetype,
        buffer,
      );
      if (!fileCheck.ok) {
        return reply.status(400).send({
          ok: false,
          code: 'INVALID_FILE_TYPE',
          message: fileCheck.message,
        });
      }

      try {
        const parsed = await parseWorkbook(buffer);
        const { entries, errors } = await validateRows(parsed.rows);

        if (errors.length > 0) {
          return reply.status(400).send({ ok: false, errors });
        }

        if (entries.length === 0) {
          return reply.status(400).send({
            ok: false,
            code: 'NO_ENTRIES',
            message: '没有可导入的考生（示例行已跳过）',
          });
        }

        const skippedCount =
          parsed.skippedExampleCount + parsed.skippedEmptyCount;
        const result = await importRoster(prisma, {
          teacherId,
          fileName: data.filename ?? 'import.xlsx',
          entries,
          skippedCount,
        });

        request.log.info(
          {
            event: 'roster_import_success',
            batchId: result.batchId,
            importedCount: result.importedCount,
          },
          'Roster import succeeded',
        );

        return reply.send({
          ok: true,
          batchId: result.batchId,
          importedCount: result.importedCount,
          skippedCount: result.skippedCount,
          fileName: data.filename ?? 'import.xlsx',
        });
      } catch (err) {
        if (err instanceof SpreadsheetReadError) {
          return reply.status(400).send({
            ok: false,
            code: err.code,
            message: err.message,
          });
        }
        if (err instanceof RosterTemplateError) {
          return reply.status(400).send({
            ok: false,
            code: err.code,
            message: err.message,
          });
        }
        request.log.error({ event: 'roster_import_failed' }, 'Roster import failed');
        return reply.status(500).send({
          ok: false,
          code: 'IMPORT_FAILED',
          message: '导入失败，请稍后重试',
        });
      }
    },
  );
}

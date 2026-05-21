import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { importPracticalBatch } from '../../../lib/practical/import-batch.js';
import { prisma } from '../../../lib/prisma.js';
import {
  assertValidSpreadsheetUpload,
} from '../../../lib/upload/spreadsheet-file.js';
import {
  assertValidWordUpload,
  getMaxPracticalXlsxBytes,
  getMaxWordUploadBytes,
} from '../../../lib/upload/word-file.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

async function collectMultipartFiles(
  request: { files: () => AsyncIterableIterator<{ fieldname: string; filename: string; mimetype: string; toBuffer: () => Promise<Buffer> }> },
): Promise<Map<string, { filename: string; mimetype: string; buffer: Buffer }>> {
  const map = new Map<string, { filename: string; mimetype: string; buffer: Buffer }>();
  for await (const part of request.files()) {
    if (part.fieldname) {
      map.set(part.fieldname, {
        filename: part.filename,
        mimetype: part.mimetype,
        buffer: await part.toBuffer(),
      });
    }
  }
  return map;
}

export async function registerAdminPracticalBatchesImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/admin/practical-batches/import',
    {
      preHandler: requireAdminSession,
      config: {
        rateLimit: {
          max: Number(process.env.IMPORT_RATE_LIMIT_MAX ?? 10),
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);

      const files = await collectMultipartFiles(request);
      const word = files.get('wordFile');
      const excel = files.get('excelFile');

      if (!word) {
        return reply.status(400).send({
          ok: false,
          code: 'MISSING_WORD_FILE',
          message: '请上传 wordFile 字段（.doc 或 .docx）',
        });
      }
      if (!excel) {
        return reply.status(400).send({
          ok: false,
          code: 'MISSING_EXCEL_FILE',
          message: '请上传 excelFile 字段（.xls、.xlsx 或 .csv）',
        });
      }

      const wordCheck = assertValidWordUpload(
        word.filename,
        word.mimetype,
        word.buffer,
        getMaxWordUploadBytes(),
      );
      if (!wordCheck.ok) {
        return reply.status(400).send({
          ok: false,
          code: 'INVALID_WORD_FILE',
          message: wordCheck.message,
        });
      }

      const excelCheck = assertValidSpreadsheetUpload(
        excel.filename,
        excel.mimetype,
        excel.buffer,
      );
      if (!excelCheck.ok) {
        return reply.status(400).send({
          ok: false,
          code: 'INVALID_EXCEL_FILE',
          message: excelCheck.message,
        });
      }
      if (excel.buffer.length > getMaxPracticalXlsxBytes()) {
        return reply.status(400).send({
          ok: false,
          code: 'INVALID_EXCEL_FILE',
          message: `附件不能超过 ${Math.round(getMaxPracticalXlsxBytes() / 1024 / 1024)}MB`,
        });
      }

      const batchId = randomUUID();
      const title =
        word.filename.replace(/\.(docx?|doc)$/i, '').trim() || word.filename;

      const result = await importPracticalBatch(prisma, {
        teacherId,
        batchId,
        title,
        wordFileName: word.filename,
        wordBuffer: word.buffer,
        excelFileName: excel.filename,
        excelBuffer: excel.buffer,
      });

      return reply.send({
        ok: true,
        batchId: result.batchId,
        title,
        wordFileName: word.filename,
        excelFileName: excel.filename,
      });
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { importFillInBatch } from '../../../lib/fillin/import-batch.js';
import { prisma } from '../../../lib/prisma.js';
import {
  assertValidSpreadsheetUpload,
  type SpreadsheetExt,
} from '../../../lib/upload/spreadsheet-file.js';
import {
  assertValidWordUpload,
  getMaxPracticalXlsxBytes,
  getMaxWordUploadBytes,
} from '../../../lib/upload/word-file.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

async function collectMultipartFiles(
  request: {
    files: () => AsyncIterableIterator<{
      fieldname: string;
      filename: string;
      mimetype: string;
      toBuffer: () => Promise<Buffer>;
    }>;
  },
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

function stripWordTitle(filename: string): string {
  return filename.replace(/\.(docx?|doc)$/i, '').trim() || filename;
}

export async function registerAdminFillInBatchesImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/admin/fill-in-batches/import',
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
      const attachment = files.get('attachmentFile');

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
          message: '请上传 excelFile 字段（.xls 或 .xlsx）',
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
      if (excelCheck.ext === 'csv') {
        return reply.status(400).send({
          ok: false,
          code: 'INVALID_EXCEL_FILE',
          message: '填空题答题卡须为 .xls 或 .xlsx 格式',
        });
      }
      if (excel.buffer.length > getMaxPracticalXlsxBytes()) {
        return reply.status(400).send({
          ok: false,
          code: 'INVALID_EXCEL_FILE',
          message: `Excel 不能超过 ${Math.round(getMaxPracticalXlsxBytes() / 1024 / 1024)}MB`,
        });
      }

      let attachmentInput:
        | { fileName: string; buffer: Buffer; ext: SpreadsheetExt }
        | undefined;
      if (attachment) {
        const attachmentCheck = assertValidSpreadsheetUpload(
          attachment.filename,
          attachment.mimetype,
          attachment.buffer,
        );
        if (!attachmentCheck.ok) {
          return reply.status(400).send({
            ok: false,
            code: 'INVALID_ATTACHMENT_FILE',
            message: attachmentCheck.message,
          });
        }
        if (attachment.buffer.length > getMaxPracticalXlsxBytes()) {
          return reply.status(400).send({
            ok: false,
            code: 'INVALID_ATTACHMENT_FILE',
            message: `附件不能超过 ${Math.round(getMaxPracticalXlsxBytes() / 1024 / 1024)}MB`,
          });
        }
        attachmentInput = {
          fileName: attachment.filename,
          buffer: attachment.buffer,
          ext: attachmentCheck.ext,
        };
      }

      const batchId = randomUUID();
      const title = stripWordTitle(word.filename);

      const result = await importFillInBatch(prisma, {
        teacherId,
        batchId,
        title,
        wordFileName: word.filename,
        wordExt: wordCheck.ext,
        wordBuffer: word.buffer,
        excelFileName: excel.filename,
        excelBuffer: excel.buffer,
        attachment: attachmentInput,
      });

      if (!result.ok) {
        return reply.status(400).send({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: '导入校验未通过',
          errors: result.errors,
        });
      }

      return reply.send({
        ok: true,
        batchId: result.batchId,
        title: result.title,
        importedCount: result.importedCount,
        wordFileName: result.wordFileName,
        excelFileName: result.excelFileName,
        attachmentFileName: result.attachmentFileName,
      });
    },
  );
}

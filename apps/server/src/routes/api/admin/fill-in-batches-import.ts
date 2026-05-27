import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { assertFillInAttachmentsWithinLimits } from '../../../lib/fillin/attachment-limits.js';
import {
  importFillInBatch,
  type FillInImportAttachmentInput,
} from '../../../lib/fillin/import-batch.js';
import { prisma } from '../../../lib/prisma.js';
import {
  assertValidArchiveUpload,
  FILLIN_ATTACHMENT_FORMAT_HINT,
} from '../../../lib/upload/archive-file.js';
import { assertValidSpreadsheetUpload } from '../../../lib/upload/spreadsheet-file.js';
import {
  assertValidWordUpload,
  getMaxPracticalXlsxBytes,
  getMaxWordUploadBytes,
} from '../../../lib/upload/word-file.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

type MultipartFile = {
  filename: string;
  mimetype: string;
  buffer: Buffer;
};

async function collectMultipartImportFiles(
  request: {
    files: () => AsyncIterableIterator<{
      fieldname: string;
      filename: string;
      mimetype: string;
      toBuffer: () => Promise<Buffer>;
    }>;
  },
): Promise<{
  singles: Map<string, MultipartFile>;
  attachmentFiles: MultipartFile[];
}> {
  const singles = new Map<string, MultipartFile>();
  const attachmentFiles: MultipartFile[] = [];
  for await (const part of request.files()) {
    if (!part.fieldname) continue;
    const file: MultipartFile = {
      filename: part.filename,
      mimetype: part.mimetype,
      buffer: await part.toBuffer(),
    };
    if (
      part.fieldname === 'attachmentFiles' ||
      part.fieldname === 'attachmentFile'
    ) {
      attachmentFiles.push(file);
      continue;
    }
    singles.set(part.fieldname, file);
  }
  return { singles, attachmentFiles };
}

function stripWordTitle(filename: string): string {
  return filename.replace(/\.(docx?|doc)$/i, '').trim() || filename;
}

function parseAttachmentInputs(
  files: MultipartFile[],
):
  | { ok: true; attachments: FillInImportAttachmentInput[] }
  | { ok: false; message: string } {
  const limits = assertFillInAttachmentsWithinLimits(files);
  if (!limits.ok) return limits;

  const attachments: FillInImportAttachmentInput[] = [];
  for (const file of files) {
    const sheetCheck = assertValidSpreadsheetUpload(
      file.filename,
      file.mimetype,
      file.buffer,
    );
    if (sheetCheck.ok) {
      attachments.push({
        fileName: file.filename,
        buffer: file.buffer,
        ext: sheetCheck.ext,
      });
      continue;
    }

    const archiveCheck = assertValidArchiveUpload(
      file.filename,
      file.mimetype,
      file.buffer,
    );
    if (archiveCheck.ok) {
      attachments.push({
        fileName: file.filename,
        buffer: file.buffer,
        ext: archiveCheck.ext,
      });
      continue;
    }

    return {
      ok: false,
      message: `${file.filename}：${FILLIN_ATTACHMENT_FORMAT_HINT}`,
    };
  }
  return { ok: true, attachments };
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

      const { singles, attachmentFiles } =
        await collectMultipartImportFiles(request);
      const word = singles.get('wordFile');
      const excel = singles.get('excelFile');

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

      const attachmentParse = parseAttachmentInputs(attachmentFiles);
      if (!attachmentParse.ok) {
        return reply.status(400).send({
          ok: false,
          code: 'INVALID_ATTACHMENT_FILE',
          message: attachmentParse.message,
        });
      }

      const batchId = randomUUID();
      const title = stripWordTitle(word.filename);

      let result;
      try {
        result = await importFillInBatch(prisma, {
          teacherId,
          batchId,
          title,
          wordFileName: word.filename,
          wordExt: wordCheck.ext,
          wordBuffer: word.buffer,
          excelFileName: excel.filename,
          excelBuffer: excel.buffer,
          attachments: attachmentParse.attachments,
        });
      } catch (err) {
        request.log.error({ err, event: 'fill_in_import_failed' }, 'Fill-in import failed');
        return reply.status(500).send({
          ok: false,
          code: 'IMPORT_FAILED',
          message:
            '导入失败。若刚升级过系统，请在本机执行数据库迁移（pnpm db:migrate）后重试；并确认答题卡「答题卡」工作表已填写有效数据。',
        });
      }

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
        attachmentCount: result.attachmentCount,
        attachmentFileNames: result.attachmentFileNames,
      });
    },
  );
}

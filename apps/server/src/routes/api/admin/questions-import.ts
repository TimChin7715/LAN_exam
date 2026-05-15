import type { FastifyInstance } from 'fastify';

import { getSessionTeacherId } from '../../../lib/auth.js';
import { importQuestions } from '../../../lib/qbank/import-questions.js';
import { parseWorkbook } from '../../../lib/qbank/parse-workbook.js';
import { QbankTemplateError } from '../../../lib/qbank/types.js';
import { validateRows } from '../../../lib/qbank/validate-rows.js';
import { assertValidXlsxUpload } from '../../../lib/qbank/xlsx-file.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

function previewQuestion(q: {
  type: string;
  stem: string;
  answerKeys: string;
  points: number;
  options: Array<{ key: string; text: string }>;
}) {
  return {
    type: q.type,
    stem: q.stem.length > 80 ? `${q.stem.slice(0, 80)}…` : q.stem,
    answerKeys: q.answerKeys,
    points: q.points,
    options: q.options.map((o) => ({ key: o.key, text: o.text })),
  };
}

export async function registerAdminQuestionsImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/admin/questions/import',
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
      const teacherId = getSessionTeacherId(request);
      if (!teacherId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          ok: false,
          code: 'MISSING_FILE',
          message: '请上传 file 字段',
        });
      }

      const buffer = await data.toBuffer();
      const fileCheck = assertValidXlsxUpload(
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
        const { questions, errors } = validateRows(parsed.rows);

        if (errors.length > 0) {
          return reply.status(400).send({ ok: false, errors });
        }

        if (questions.length === 0) {
          return reply.status(400).send({
            ok: false,
            code: 'NO_QUESTIONS',
            message: '没有可导入的题目（示例行已跳过）',
          });
        }

        const skippedCount =
          parsed.skippedExampleCount + parsed.skippedEmptyCount;
        const result = await importQuestions(prisma, {
          teacherId,
          fileName: data.filename ?? 'import.xlsx',
          questions,
          skippedCount,
        });

        return reply.send({
          ok: true,
          batchId: result.batchId,
          importedCount: result.importedCount,
          skippedCount: result.skippedCount,
          previewQuestions: questions.slice(0, 3).map(previewQuestion),
        });
      } catch (err) {
        if (err instanceof QbankTemplateError) {
          return reply.status(400).send({
            ok: false,
            code: err.code,
            message: err.message,
          });
        }
        request.log.error(err, 'question import failed');
        return reply.status(500).send({
          ok: false,
          code: 'IMPORT_FAILED',
          message: '导入失败，请稍后重试',
        });
      }
    },
  );
}

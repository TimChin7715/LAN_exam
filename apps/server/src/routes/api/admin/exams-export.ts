import type { FastifyInstance } from 'fastify';

import { getSessionTeacherId } from '../../../lib/auth.js';
import { buildExamExportWorkbook } from '../../../lib/exam/export-workbook.js';
import { prisma } from '../../../lib/prisma.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

function safeFilename(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'exam';
  return `${base}-成绩导出.xlsx`;
}

export async function registerAdminExamsExportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/exams/:id/export',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = getSessionTeacherId(request)!;

      const { id } = request.params as { id: string };

      const exam = await prisma.exam.findFirst({
        where: { id, teacherId },
        select: { id: true, title: true },
      });

      if (!exam) {
        return reply.status(404).send({
          ok: false,
          code: 'EXAM_NOT_FOUND',
          message: '考试不存在',
        });
      }

      const workbook = await buildExamExportWorkbook(exam.id);
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = safeFilename(exam.title);
      const encoded = encodeURIComponent(filename);

      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encoded}`,
        )
        .send(Buffer.from(buffer));
    },
  );
}

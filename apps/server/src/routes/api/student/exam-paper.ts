import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { examPaperGate } from '../../../lib/concurrency/gates.js';
import { ServerBusyError } from '../../../lib/concurrency/server-busy-error.js';
import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import { buildExamPaperResponse } from '../../../lib/exam/load-exam-paper.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { SERVER_BUSY_CODE, SERVER_BUSY_MESSAGE } from '../../../lib/errors.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

const paperQuerySchema = z.object({
  examId: z.string().min(1),
});

export async function registerStudentExamPaperRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/student/exam/paper',
    { preHandler: requireStudentSession },
    async (request, reply) => {
      const rosterOrReply = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterOrReply !== 'string') {
        return rosterOrReply;
      }
      const rosterEntryId = rosterOrReply;

      const parsed = paperQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId } = parsed.data;

      try {
        await assertStudentExamAccess(rosterEntryId, examId, 'read');
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      if (!examPaperGate.tryAcquire()) {
        return reply
          .status(503)
          .header('Retry-After', '2')
          .send({
            code: SERVER_BUSY_CODE,
            message: SERVER_BUSY_MESSAGE,
          });
      }

      try {
        const paper = await buildExamPaperResponse(examId, rosterEntryId);
        if (!paper) {
          return reply.status(404).send({
            code: 'EXAM_NOT_FOUND',
            message: '考试不存在',
          });
        }
        return reply.send(paper);
      } catch (err) {
        if (err instanceof ServerBusyError) {
          return reply
            .status(503)
            .header('Retry-After', '2')
            .send({
              code: SERVER_BUSY_CODE,
              message: err.message,
            });
        }
        throw err;
      } finally {
        examPaperGate.release();
      }
    },
  );
}

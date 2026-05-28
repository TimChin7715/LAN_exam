import type { FastifyInstance } from 'fastify';

import { examSyncGate } from '../../../lib/concurrency/gates.js';
import { ServerBusyError } from '../../../lib/concurrency/server-busy-error.js';
import { examSyncProgressBodySchema } from '../../../lib/exam/answer-draft-schemas.js';
import { assertStudentExamAccess } from '../../../lib/exam/access.js';
import {
  AnswerDraftPersistError,
  assertCanPersistAnswerDrafts,
  normalizeAnswerDrafts,
  persistAnswerDrafts,
} from '../../../lib/exam/persist-answer-drafts.js';
import { ExamAccessError } from '../../../lib/exam/types.js';
import { SERVER_BUSY_CODE, SERVER_BUSY_MESSAGE } from '../../../lib/errors.js';
import {
  ensureStudentRosterEntryId,
  requireStudentSession,
} from '../../../plugins/student-guard.js';

export async function registerStudentExamSyncProgressRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/student/exam/sync-progress',
    {
      preHandler: requireStudentSession,
      config: {
        rateLimit: {
          max: 8,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const rosterOrReply = await ensureStudentRosterEntryId(request, reply);
      if (typeof rosterOrReply !== 'string') {
        return rosterOrReply;
      }
      const rosterEntryId = rosterOrReply;

      const parsed = examSyncProgressBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
        });
      }

      const { examId, answers } = parsed.data;
      const normalizedAnswers = normalizeAnswerDrafts(answers);

      try {
        await assertStudentExamAccess(rosterEntryId, examId, 'write');
      } catch (err) {
        if (err instanceof ExamAccessError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      try {
        const result = await examSyncGate.run(async () => {
          await assertCanPersistAnswerDrafts(
            examId,
            rosterEntryId,
            normalizedAnswers,
          );
          return persistAnswerDrafts(examId, rosterEntryId, normalizedAnswers);
        });

        const syncedAt = new Date().toISOString();
        return reply.send({
          ok: true,
          syncedAt,
          answerCount: result.answerCount,
          maxDraftUpdatedAt: result.maxDraftUpdatedAt,
        });
      } catch (err) {
        if (err instanceof ServerBusyError) {
          return reply
            .status(503)
            .header('Retry-After', '5')
            .send({
              code: SERVER_BUSY_CODE,
              message: SERVER_BUSY_MESSAGE,
            });
        }
        if (err instanceof AnswerDraftPersistError) {
          return reply.status(err.statusCode).send({
            code: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
}

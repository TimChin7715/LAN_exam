import type { FastifyInstance } from 'fastify';

import { resolveAdminTeacherId } from '../../../lib/admin-context.js';
import { prisma } from '../../../lib/prisma.js';
import {
  createRosterEntry,
  deleteRosterEntry,
  parseAndValidateEntryBody,
  RosterBatchEntryLimitError,
  RosterBatchNotFoundError,
  RosterEntryDuplicateError,
  RosterEntryHasSubmissionsError,
  RosterEntryNotFoundError,
  updateRosterEntry,
} from '../../../lib/roster/roster-entry-mutations.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

function mapEntryResponse(entry: {
  id: string;
  fullName: string;
  organization: string;
  nationalId: string;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    fullName: entry.fullName,
    organization: entry.organization,
    nationalId: entry.nationalId,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function registerAdminRosterEntriesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/admin/roster-batches/:batchId/entries',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { batchId } = request.params as { batchId: string };

      const parsed = parseAndValidateEntryBody(request.body);
      if (!parsed.ok) {
        return reply.status(400).send({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: parsed.message,
        });
      }

      try {
        const entry = await createRosterEntry(
          prisma,
          teacherId,
          batchId,
          parsed.entry,
        );
        return reply.send({ ok: true, entry: mapEntryResponse(entry) });
      } catch (err) {
        if (err instanceof RosterBatchNotFoundError) {
          return reply.status(404).send({
            ok: false,
            code: 'BATCH_NOT_FOUND',
            message: '名单不存在',
          });
        }
        if (err instanceof RosterEntryDuplicateError) {
          return reply.status(409).send({
            ok: false,
            code: 'DUPLICATE_ENTRY',
            message: '该批次中已存在相同姓名与身份证号的考生',
          });
        }
        if (err instanceof RosterBatchEntryLimitError) {
          return reply.status(400).send({
            ok: false,
            code: 'BATCH_ENTRY_LIMIT',
            message: '该名单人数已达上限',
          });
        }
        throw err;
      }
    },
  );

  app.patch(
    '/api/admin/roster-entries/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      const parsed = parseAndValidateEntryBody(request.body);
      if (!parsed.ok) {
        return reply.status(400).send({
          ok: false,
          code: 'VALIDATION_ERROR',
          message: parsed.message,
        });
      }

      try {
        const entry = await updateRosterEntry(
          prisma,
          teacherId,
          id,
          parsed.entry,
        );
        return reply.send({ ok: true, entry: mapEntryResponse(entry) });
      } catch (err) {
        if (err instanceof RosterEntryNotFoundError) {
          return reply.status(404).send({
            ok: false,
            code: 'ENTRY_NOT_FOUND',
            message: '考生不存在',
          });
        }
        if (err instanceof RosterEntryDuplicateError) {
          return reply.status(409).send({
            ok: false,
            code: 'DUPLICATE_ENTRY',
            message: '该批次中已存在相同姓名与身份证号的考生',
          });
        }
        if (err instanceof RosterEntryHasSubmissionsError) {
          return reply.status(409).send({
            ok: false,
            code: 'ENTRY_HAS_SUBMISSIONS',
            message: '该考生已有答卷，无法修改',
            examTitles: err.examTitles,
          });
        }
        throw err;
      }
    },
  );

  app.delete(
    '/api/admin/roster-entries/:id',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const teacherId = await resolveAdminTeacherId(request);
      const { id } = request.params as { id: string };

      try {
        await deleteRosterEntry(prisma, teacherId, id);
        return reply.send({ ok: true });
      } catch (err) {
        if (err instanceof RosterEntryNotFoundError) {
          return reply.status(404).send({
            ok: false,
            code: 'ENTRY_NOT_FOUND',
            message: '考生不存在',
          });
        }
        if (err instanceof RosterEntryHasSubmissionsError) {
          return reply.status(409).send({
            ok: false,
            code: 'ENTRY_HAS_SUBMISSIONS',
            message: '该考生已有答卷，无法删除',
            examTitles: err.examTitles,
          });
        }
        throw err;
      }
    },
  );
}

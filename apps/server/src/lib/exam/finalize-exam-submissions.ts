import type { FastifyBaseLogger } from 'fastify';

import { prisma } from '../prisma.js';
import { submitExam } from './submit.js';
import { SubmitExamError } from './types.js';

export async function finalizeExamSubmissions(
  examId: string,
  log?: FastifyBaseLogger,
): Promise<{ submitted: number; skipped: number; failed: number }> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      status: true,
      rosterBatchId: true,
    },
  });

  if (!exam || exam.status !== 'IN_PROGRESS') {
    return { submitted: 0, skipped: 0, failed: 0 };
  }

  const entries = await prisma.rosterEntry.findMany({
    where: { batchId: exam.rosterBatchId },
    select: { id: true },
  });

  let submitted = 0;
  let skipped = 0;
  let failed = 0;

  for (const { id: rosterEntryId } of entries) {
    try {
      await submitExam({ examId, rosterEntryId, mode: 'deadline' });
      submitted += 1;
    } catch (err) {
      if (err instanceof SubmitExamError && err.code === 'ALREADY_SUBMITTED') {
        skipped += 1;
        continue;
      }
      failed += 1;
      log?.warn(
        { examId, rosterEntryId, err },
        'finalizeExamSubmissions: submit failed for roster entry',
      );
    }
  }

  return { submitted, skipped, failed };
}

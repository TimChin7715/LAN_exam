import type { PrismaClient } from '@prisma/client';

import { assignSeatsForMissingEntries } from '../seat/assign-seats-for-missing.js';

/** After a new roster entry is added, assign seats for in-progress exams on this batch. */
export async function syncAfterRosterEntryCreated(
  prisma: PrismaClient,
  batchId: string,
): Promise<void> {
  const exams = await prisma.exam.findMany({
    where: { rosterBatchId: batchId, status: 'IN_PROGRESS' },
    select: { id: true, rosterBatchId: true },
  });

  for (const exam of exams) {
    await assignSeatsForMissingEntries(prisma, exam.id, exam.rosterBatchId);
  }
}

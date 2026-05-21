import type { Prisma } from '@prisma/client';

export type SeatAssignmentRule = 'random_shuffle_v1';

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export async function assignExamSeats(
  tx: Prisma.TransactionClient,
  examId: string,
  rosterBatchId: string,
  rule: SeatAssignmentRule = 'random_shuffle_v1',
  options?: { force?: boolean },
): Promise<{ assigned: boolean; count: number }> {
  if (rule !== 'random_shuffle_v1') {
    throw new Error(`Unsupported seat assignment rule: ${rule}`);
  }

  const existingCount = await tx.examSeatAssignment.count({
    where: { examId },
  });
  if (existingCount > 0 && !options?.force) {
    return { assigned: false, count: existingCount };
  }

  if (options?.force) {
    await tx.examSeatAssignment.deleteMany({ where: { examId } });
  }

  const entries = await tx.rosterEntry.findMany({
    where: { batchId: rosterBatchId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (entries.length === 0) {
    return { assigned: false, count: 0 };
  }

  const shuffled = [...entries];
  shuffleInPlace(shuffled);

  await tx.examSeatAssignment.createMany({
    data: shuffled.map((entry, index) => ({
      examId,
      rosterEntryId: entry.id,
      seatLabel: String(index + 1),
      displayOrder: index,
    })),
  });

  return { assigned: true, count: shuffled.length };
}

export async function ensureExamSeatsAssigned(
  tx: Prisma.TransactionClient,
  examId: string,
  rosterBatchId: string,
): Promise<void> {
  await assignExamSeats(tx, examId, rosterBatchId);
}

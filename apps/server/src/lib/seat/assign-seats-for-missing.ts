import type { PrismaClient } from '@prisma/client';

import { assignExamSeats } from './assign-seats.js';

export function maxSeatLabelNumeric(labels: string[]): number {
  let max = 0;
  for (const label of labels) {
    const n = Number.parseInt(label, 10);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  return max;
}

/** Append seat labels after the current numeric maximum (e.g. 3 → 4, 5). */
export function nextSeatLabels(existingLabels: string[], count: number): string[] {
  const start = maxSeatLabelNumeric(existingLabels);
  return Array.from({ length: count }, (_, i) => String(start + 1 + i));
}

/**
 * Assign seats for roster entries in the batch that lack a seat for this exam.
 * If no seats exist yet, runs full random assignment for the whole batch.
 */
export async function assignSeatsForMissingEntries(
  prisma: PrismaClient,
  examId: string,
  rosterBatchId: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.examSeatAssignment.count({
      where: { examId },
    });

    if (existingCount === 0) {
      const result = await assignExamSeats(tx, examId, rosterBatchId);
      return result.count;
    }

    const assigned = await tx.examSeatAssignment.findMany({
      where: { examId },
      select: { rosterEntryId: true, seatLabel: true, displayOrder: true },
    });
    const assignedIds = new Set(assigned.map((a) => a.rosterEntryId));

    const unassigned = await tx.rosterEntry.findMany({
      where: {
        batchId: rosterBatchId,
        id: { notIn: [...assignedIds] },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (unassigned.length === 0) {
      return existingCount;
    }

    const labels = nextSeatLabels(
      assigned.map((a) => a.seatLabel),
      unassigned.length,
    );
    const nextDisplayOrder =
      assigned.reduce((max, a) => Math.max(max, a.displayOrder), -1) + 1;

    await tx.examSeatAssignment.createMany({
      data: unassigned.map((entry, index) => ({
        examId,
        rosterEntryId: entry.id,
        seatLabel: labels[index]!,
        displayOrder: nextDisplayOrder + index,
      })),
    });

    return existingCount + unassigned.length;
  });
}

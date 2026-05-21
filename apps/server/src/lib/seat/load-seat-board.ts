import type { PrismaClient } from '@prisma/client';

import { assignExamSeats } from './assign-seats.js';
import { computeSeatGridDimensions } from './seat-grid.js';
import {
  computeStudentSeatDisplayStatus,
  type StudentSeatDisplayStatus,
} from './seat-display-status.js';

export type SeatBoardItem = {
  fullName: string;
  seatLabel: string;
};

export type SeatBoardPayload = {
  examId: string;
  title: string;
  status: string;
  displayStatus?: StudentSeatDisplayStatus;
  cols: number;
  rows: number;
  items: SeatBoardItem[];
};

export async function loadExamSeatBoard(
  prisma: PrismaClient,
  exam: {
    id: string;
    title: string;
    status: string;
    rosterBatchId: string;
    scheduledStartAt?: Date | null;
  },
  options?: { includeDisplayStatus?: boolean },
): Promise<SeatBoardPayload> {
  let count = await prisma.examSeatAssignment.count({
    where: { examId: exam.id },
  });

  if (count === 0) {
    await prisma.$transaction(async (tx) => {
      await assignExamSeats(tx, exam.id, exam.rosterBatchId);
    });
    count = await prisma.examSeatAssignment.count({
      where: { examId: exam.id },
    });
  }

  const assignments = await prisma.examSeatAssignment.findMany({
    where: { examId: exam.id },
    orderBy: { displayOrder: 'asc' },
    select: {
      seatLabel: true,
      rosterEntry: { select: { fullName: true } },
    },
  });

  const { cols, rows } = computeSeatGridDimensions(assignments.length);

  const payload: SeatBoardPayload = {
    examId: exam.id,
    title: exam.title,
    status: exam.status,
    cols,
    rows,
    items: assignments.map((a) => ({
      fullName: a.rosterEntry.fullName,
      seatLabel: a.seatLabel,
    })),
  };

  if (
    options?.includeDisplayStatus &&
    (exam.status === 'DRAFT' || exam.status === 'IN_PROGRESS')
  ) {
    payload.displayStatus = computeStudentSeatDisplayStatus({
      status: exam.status,
      scheduledStartAt: exam.scheduledStartAt ?? null,
    });
  }

  return payload;
}

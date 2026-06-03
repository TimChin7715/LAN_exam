import type { PrismaClient } from '@prisma/client';

export type RosterInProgressExam = {
  id: string;
  title: string;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
};

/** All in-progress exams for a roster batch (deterministic order). */
export async function listRosterInProgressExams(
  prisma: PrismaClient,
  rosterBatchId: string,
): Promise<RosterInProgressExam[]> {
  return prisma.exam.findMany({
    where: { rosterBatchId, status: 'IN_PROGRESS' },
    orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  });
}

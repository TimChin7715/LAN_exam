import type { PrismaClient } from '@prisma/client';

export type PublicSeatExamSelect = {
  id: string;
  title: string;
  status: 'DRAFT' | 'IN_PROGRESS';
  teacherId: string;
  rosterBatchId: string;
  scheduledStartAt: Date | null;
};

export async function resolvePublicSeatExam(
  prisma: PrismaClient,
): Promise<PublicSeatExamSelect | null> {
  const inProgress = await prisma.exam.findFirst({
    where: { status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      teacherId: true,
      rosterBatchId: true,
      scheduledStartAt: true,
    },
  });

  if (inProgress) {
    return { ...inProgress, status: 'IN_PROGRESS' as const };
  }

  const draft = await prisma.exam.findFirst({
    where: { status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      teacherId: true,
      rosterBatchId: true,
      scheduledStartAt: true,
    },
  });

  if (!draft) {
    return null;
  }

  return { ...draft, status: 'DRAFT' as const };
}

import type { PrismaClient } from '@prisma/client';

export type PublicSeatExamSelect = {
  id: string;
  title: string;
  status: 'DRAFT' | 'IN_PROGRESS';
  teacherId: string;
  rosterBatchId: string;
  scheduledStartAt: Date | null;
};

/** All public seat-board exams (in-progress first; else latest draft). */
export async function listPublicSeatExams(
  prisma: PrismaClient,
): Promise<PublicSeatExamSelect[]> {
  const inProgress = await prisma.exam.findMany({
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

  if (inProgress.length > 0) {
    return inProgress.map((e) => ({ ...e, status: 'IN_PROGRESS' as const }));
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

  return draft ? [{ ...draft, status: 'DRAFT' as const }] : [];
}

export async function resolvePublicSeatExam(
  prisma: PrismaClient,
): Promise<PublicSeatExamSelect | null> {
  const exams = await listPublicSeatExams(prisma);
  return exams[0] ?? null;
}

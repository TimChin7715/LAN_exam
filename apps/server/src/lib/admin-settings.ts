import type { PrismaClient } from '@prisma/client';

export async function getTeacherShowSeatBoard(
  prisma: PrismaClient,
  teacherId: string,
): Promise<boolean> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { showSeatBoard: true },
  });
  return teacher?.showSeatBoard ?? true;
}

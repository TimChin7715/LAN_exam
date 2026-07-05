import type { PrismaClient } from '@prisma/client';

import {
  getLocalAdminTeacherId,
  isAdminAuthDisabled,
} from './admin-context.js';
import { listPublicSeatExams } from './seat/resolve-public-seat-exam.js';

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

/** Whether student-facing pages should show the seat board panel. */
export async function resolveStudentShowSeatBoard(
  prisma: PrismaClient,
): Promise<boolean> {
  if (isAdminAuthDisabled()) {
    return getTeacherShowSeatBoard(prisma, await getLocalAdminTeacherId());
  }

  const exams = await listPublicSeatExams(prisma);
  if (exams.length > 0) {
    for (const exam of exams) {
      if (await getTeacherShowSeatBoard(prisma, exam.teacherId)) {
        return true;
      }
    }
    return false;
  }

  const latestExam = await prisma.exam.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { teacherId: true },
  });
  const teacherId = latestExam?.teacherId ?? (await getLocalAdminTeacherId());
  return getTeacherShowSeatBoard(prisma, teacherId);
}

/** Exams eligible for student seat-board payloads (respects admin mode + setting). */
export async function listStudentSeatBoardExams(prisma: PrismaClient) {
  const exams = await listPublicSeatExams(prisma);

  if (isAdminAuthDisabled()) {
    const localId = await getLocalAdminTeacherId();
    if (!(await getTeacherShowSeatBoard(prisma, localId))) {
      return [];
    }
    return exams.filter((exam) => exam.teacherId === localId);
  }

  const boards = [];
  for (const exam of exams) {
    if (await getTeacherShowSeatBoard(prisma, exam.teacherId)) {
      boards.push(exam);
    }
  }
  return boards;
}

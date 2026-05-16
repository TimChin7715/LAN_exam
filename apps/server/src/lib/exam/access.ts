import { prisma } from '../prisma.js';
import { ExamAccessError } from './types.js';

export type ExamAccessMode = 'read' | 'write' | 'submit';

export async function assertStudentExamAccess(
  rosterEntryId: string,
  examId: string,
  mode: ExamAccessMode,
): Promise<{ examId: string; rosterEntryId: string; rosterBatchId: string }> {
  const entry = await prisma.rosterEntry.findUnique({
    where: { id: rosterEntryId },
    select: { id: true, batchId: true },
  });

  if (!entry) {
    throw new ExamAccessError(
      403,
      'FORBIDDEN',
      '当前无法参加本场考试。',
    );
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      status: true,
      rosterBatchId: true,
    },
  });

  if (!exam || entry.batchId !== exam.rosterBatchId) {
    throw new ExamAccessError(
      403,
      'FORBIDDEN',
      '当前无法参加本场考试。',
    );
  }

  if (mode === 'read') {
    if (exam.status !== 'IN_PROGRESS') {
      throw new ExamAccessError(
        403,
        'FORBIDDEN',
        '当前无法参加本场考试。',
      );
    }
    return {
      examId: exam.id,
      rosterEntryId: entry.id,
      rosterBatchId: exam.rosterBatchId,
    };
  }

  if (exam.status === 'ENDED') {
    throw new ExamAccessError(
      409,
      'EXAM_ENDED',
      '考试已结束，无法继续作答。',
    );
  }

  if (exam.status !== 'IN_PROGRESS') {
    throw new ExamAccessError(
      403,
      'FORBIDDEN',
      '当前无法参加本场考试。',
    );
  }

  return {
    examId: exam.id,
    rosterEntryId: entry.id,
    rosterBatchId: exam.rosterBatchId,
  };
}

import type { PrismaClient } from '@prisma/client';

import { clearExamPaperCache } from '../exam/exam-paper-cache.js';
import { deleteStorageTree } from '../storage/index.js';

export const CLEAR_ALL_DATA_CONFIRM_PHRASE = '清除全部数据';

export type ClearTeacherDataResult = {
  exams: number;
  questionBatches: number;
  rosterBatches: number;
  fillInBatches: number;
};

async function removeStoragePrefix(prefix: string): Promise<void> {
  try {
    await deleteStorageTree(prefix);
  } catch {
    // 文件可能已不存在；清除库内记录优先
  }
}

export async function clearAllTeacherData(
  prisma: PrismaClient,
  teacherId: string,
): Promise<ClearTeacherDataResult> {
  const [exams, fillInBatches] = await Promise.all([
    prisma.exam.findMany({
      where: { teacherId },
      select: { id: true },
    }),
    prisma.fillInQuestionImportBatch.findMany({
      where: { teacherId },
      select: { id: true },
    }),
  ]);

  const result = await prisma.$transaction(async (tx) => {
    // Answer.examQuestionId 无 ON DELETE CASCADE；须先删答卷再删考试。
    await tx.submission.deleteMany({ where: { exam: { teacherId } } });

    const deletedExams = await tx.exam.deleteMany({ where: { teacherId } });
    const deletedQuestions = await tx.questionImportBatch.deleteMany({
      where: { teacherId },
    });
    const deletedFillIn = await tx.fillInQuestionImportBatch.deleteMany({
      where: { teacherId },
    });
    const deletedRoster = await tx.rosterImportBatch.deleteMany({
      where: { teacherId },
    });

    return {
      exams: deletedExams.count,
      questionBatches: deletedQuestions.count,
      rosterBatches: deletedRoster.count,
      fillInBatches: deletedFillIn.count,
    };
  });

  await Promise.all([
    ...exams.map((e) => removeStoragePrefix(`exam-work/${e.id}`)),
    ...fillInBatches.map((b) => removeStoragePrefix(`fill-in-batches/${b.id}`)),
    removeStoragePrefix('practical-batches'),
  ]);

  clearExamPaperCache();

  return result;
}

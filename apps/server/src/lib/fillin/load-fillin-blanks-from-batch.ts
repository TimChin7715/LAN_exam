import type { PrismaClient } from '@prisma/client';

import type { ParsedFillInBlank } from './types.js';

/** 从已入库 Question 行还原空位，供预览注入与懒重建使用。 */
export async function loadFillInBlanksForBatch(
  prisma: PrismaClient,
  batchId: string,
): Promise<ParsedFillInBlank[]> {
  const questions = await prisma.question.findMany({
    where: { fillInBatchId: batchId, type: 'FILL' },
    orderBy: { importSortOrder: 'asc' },
    select: {
      stem: true,
      answerKeys: true,
      points: true,
      knowledgePoints: true,
      explanation: true,
      importSortOrder: true,
    },
  });

  return questions.map((q) => ({
    rowNumber: q.importSortOrder + 1,
    questionNo: parseInt(q.knowledgePoints ?? '1', 10) || 1,
    blankIndex: parseInt(q.explanation ?? '1', 10) || 1,
    stem: q.stem,
    answerKeys: q.answerKeys,
    points: q.points,
  }));
}

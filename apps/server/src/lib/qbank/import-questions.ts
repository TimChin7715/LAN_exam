import type { PrismaClient } from '@prisma/client';

import type { ParsedQuestion } from './types.js';

export type ImportQuestionsInput = {
  teacherId: string;
  fileName: string;
  questions: ParsedQuestion[];
  skippedCount: number;
};

export type ImportQuestionsResult = {
  batchId: string;
  importedCount: number;
  skippedCount: number;
};

export async function importQuestions(
  prisma: PrismaClient,
  input: ImportQuestionsInput,
): Promise<ImportQuestionsResult> {
  const { teacherId, fileName, questions, skippedCount } = input;

  const batch = await prisma.$transaction(
    async (tx) => {
      return tx.questionImportBatch.create({
        data: {
          teacherId,
          fileName,
          totalRows: questions.length,
          importedCount: questions.length,
          skippedCount,
          questions: {
            create: questions.map((q, importSortOrder) => ({
              type: q.type,
              stem: q.stem,
              answerKeys: q.answerKeys,
              points: q.points,
              difficulty: q.difficulty,
              explanation: q.explanation,
              knowledgePoints: q.knowledgePoints,
              importSortOrder,
              multiScoringRule: q.multiScoringRule ?? null,
              options: {
                create: q.options.map((o) => ({
                  key: o.key,
                  text: o.text,
                  sortOrder: o.sortOrder,
                })),
              },
            })),
          },
        },
      });
    },
    { timeout: 30_000 },
  );

  return {
    batchId: batch.id,
    importedCount: batch.importedCount,
    skippedCount: batch.skippedCount,
  };
}

import type { Prisma } from '@prisma/client';

export async function materializeExamQuestionSets(
  tx: Prisma.TransactionClient,
  examId: string,
  input: {
    questionBatchId?: string | null;
    fillInBatchId?: string | null;
  },
): Promise<number> {
  await tx.examQuestion.deleteMany({ where: { examId } });

  const questionIds: string[] = [];

  if (input.questionBatchId) {
    const objective = await tx.question.findMany({
      where: { batchId: input.questionBatchId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    questionIds.push(...objective.map((q) => q.id));
  }

  if (input.fillInBatchId) {
    const fillIn = await tx.question.findMany({
      where: { fillInBatchId: input.fillInBatchId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    questionIds.push(...fillIn.map((q) => q.id));
  }

  if (questionIds.length === 0) {
    return 0;
  }

  await tx.examQuestion.createMany({
    data: questionIds.map((questionId, index) => ({
      examId,
      questionId,
      sortOrder: index,
    })),
  });

  return questionIds.length;
}

/** @deprecated use materializeExamQuestionSets */
export async function materializeExamQuestions(
  tx: Prisma.TransactionClient,
  examId: string,
  questionBatchId: string,
): Promise<number> {
  return materializeExamQuestionSets(tx, examId, { questionBatchId });
}

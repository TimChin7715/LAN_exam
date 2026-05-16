import type { Prisma } from '@prisma/client';

export async function materializeExamQuestions(
  tx: Prisma.TransactionClient,
  examId: string,
  questionBatchId: string,
): Promise<number> {
  await tx.examQuestion.deleteMany({ where: { examId } });

  const questions = await tx.question.findMany({
    where: { batchId: questionBatchId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (questions.length === 0) {
    return 0;
  }

  await tx.examQuestion.createMany({
    data: questions.map((q, index) => ({
      examId,
      questionId: q.id,
      sortOrder: index,
    })),
  });

  return questions.length;
}

import type { Prisma, PrismaClient } from '@prisma/client';

export const BATCH_LINKED_TO_EXAM_MESSAGE =
  '已被考试引用，无法删除';

export class BatchDeleteBlockedError extends Error {
  constructor(
    public readonly examTitles: string[],
    message = BATCH_LINKED_TO_EXAM_MESSAGE,
  ) {
    super(message);
    this.name = 'BatchDeleteBlockedError';
  }
}

type ExamBatchLinkFilter =
  | { questionBatchId: string }
  | { rosterBatchId: string }
  | { fillInBatchId: string }
  | { practicalBatchId: string };

export async function findLinkedExamTitles(
  prisma: PrismaClient,
  teacherId: string,
  link: ExamBatchLinkFilter,
  take = 5,
): Promise<string[]> {
  const exams = await prisma.exam.findMany({
    where: { ...link, teacherId },
    select: { title: true },
    take,
  });
  return exams.map((e) => e.title);
}

/** 题库 / 名单：任意关联考试均不可删，保留考后导出所需数据。 */
export async function assertBatchNotLinkedToAnyExam(
  prisma: PrismaClient,
  teacherId: string,
  link: { questionBatchId: string } | { rosterBatchId: string },
): Promise<void> {
  const titles = await findLinkedExamTitles(prisma, teacherId, link);
  if (titles.length > 0) {
    throw new BatchDeleteBlockedError(titles);
  }
}

async function removeExamQuestionsForQuestionIds(
  tx: Prisma.TransactionClient,
  questionIds: string[],
): Promise<void> {
  if (questionIds.length === 0) return;

  const examQuestions = await tx.examQuestion.findMany({
    where: { questionId: { in: questionIds } },
    select: { id: true },
  });
  const examQuestionIds = examQuestions.map((eq) => eq.id);
  if (examQuestionIds.length === 0) return;

  await tx.answer.deleteMany({
    where: { examQuestionId: { in: examQuestionIds } },
  });
  await tx.answerDraft.deleteMany({
    where: { examQuestionId: { in: examQuestionIds } },
  });
  await tx.examQuestion.deleteMany({
    where: { id: { in: examQuestionIds } },
  });
}

export async function assertBatchNotUsedByInProgressExam(
  prisma: PrismaClient,
  teacherId: string,
  link: { fillInBatchId: string } | { practicalBatchId: string },
): Promise<void> {
  const inProgress = await prisma.exam.findMany({
    where: { ...link, teacherId, status: 'IN_PROGRESS' },
    select: { title: true },
    take: 5,
  });
  if (inProgress.length > 0) {
    throw new BatchDeleteBlockedError(
      inProgress.map((e) => e.title),
      '进行中的考试仍引用该批次，请先结束考试后再删除',
    );
  }
}

export async function deleteQuestionBatchIfUnused(
  prisma: PrismaClient,
  teacherId: string,
  batchId: string,
): Promise<void> {
  await assertBatchNotLinkedToAnyExam(prisma, teacherId, {
    questionBatchId: batchId,
  });
  await prisma.questionImportBatch.delete({ where: { id: batchId } });
}

export async function deleteRosterBatchIfUnused(
  prisma: PrismaClient,
  teacherId: string,
  batchId: string,
): Promise<void> {
  await assertBatchNotLinkedToAnyExam(prisma, teacherId, {
    rosterBatchId: batchId,
  });
  await prisma.rosterImportBatch.delete({ where: { id: batchId } });
}

export async function unlinkExamsAndDeleteFillInBatch(
  prisma: PrismaClient,
  teacherId: string,
  batchId: string,
): Promise<void> {
  await assertBatchNotUsedByInProgressExam(prisma, teacherId, {
    fillInBatchId: batchId,
  });

  const questionIds = (
    await prisma.question.findMany({
      where: { fillInBatchId: batchId },
      select: { id: true },
    })
  ).map((q) => q.id);

  await prisma.$transaction(async (tx) => {
    await removeExamQuestionsForQuestionIds(tx, questionIds);
    await tx.exam.updateMany({
      where: { fillInBatchId: batchId, teacherId },
      data: { fillInBatchId: null },
    });
    await tx.fillInQuestionImportBatch.delete({ where: { id: batchId } });
  });
}

export async function unlinkExamsAndDeletePracticalBatch(
  prisma: PrismaClient,
  teacherId: string,
  batchId: string,
): Promise<void> {
  await assertBatchNotUsedByInProgressExam(prisma, teacherId, {
    practicalBatchId: batchId,
  });

  await prisma.$transaction(async (tx) => {
    await tx.exam.updateMany({
      where: { practicalBatchId: batchId, teacherId },
      data: { practicalBatchId: null },
    });
    await tx.practicalQuestionImportBatch.delete({ where: { id: batchId } });
  });
}

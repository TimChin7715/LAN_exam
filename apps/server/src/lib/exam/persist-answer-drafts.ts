import { prisma } from '../prisma.js';

export type AnswerDraftInput = {
  examQuestionId: string;
  selectedKeys: string;
};

export class AnswerDraftPersistError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AnswerDraftPersistError';
  }
}

export function normalizeAnswerDrafts(
  answers: AnswerDraftInput[],
): AnswerDraftInput[] {
  return [
    ...new Map(
      answers.map((item) => [item.examQuestionId, item.selectedKeys]),
    ).entries(),
  ].map(([examQuestionId, selectedKeys]) => ({
    examQuestionId,
    selectedKeys,
  }));
}

export async function assertCanPersistAnswerDrafts(
  examId: string,
  rosterEntryId: string,
  normalizedAnswers: AnswerDraftInput[],
): Promise<void> {
  const questionCount = await prisma.examQuestion.count({
    where: { examId },
  });
  if (normalizedAnswers.length > questionCount) {
    throw new AnswerDraftPersistError(
      400,
      'VALIDATION_ERROR',
      '请求参数无效',
    );
  }

  const existingSubmission = await prisma.submission.findUnique({
    where: {
      examId_rosterEntryId: { examId, rosterEntryId },
    },
    select: { id: true },
  });

  if (existingSubmission) {
    throw new AnswerDraftPersistError(
      409,
      'ALREADY_SUBMITTED',
      '试卷已提交，无法修改作答',
    );
  }

  if (normalizedAnswers.length === 0) {
    return;
  }

  const examQuestionIds = normalizedAnswers.map((a) => a.examQuestionId);

  const validQuestions = await prisma.examQuestion.findMany({
    where: {
      examId,
      id: { in: examQuestionIds },
    },
    select: { id: true },
  });

  if (validQuestions.length !== examQuestionIds.length) {
    throw new AnswerDraftPersistError(
      400,
      'VALIDATION_ERROR',
      '请求参数无效',
    );
  }
}

export async function persistAnswerDrafts(
  examId: string,
  rosterEntryId: string,
  normalizedAnswers: AnswerDraftInput[],
): Promise<{ answerCount: number; maxDraftUpdatedAt: string | null }> {
  if (normalizedAnswers.length === 0) {
    return { answerCount: 0, maxDraftUpdatedAt: null };
  }

  const examQuestionIds = normalizedAnswers.map((a) => a.examQuestionId);

  await prisma.$transaction(async (tx) => {
    await tx.answerDraft.deleteMany({
      where: {
        examId,
        rosterEntryId,
        examQuestionId: { in: examQuestionIds },
      },
    });

    await tx.answerDraft.createMany({
      data: normalizedAnswers.map((item) => ({
        examId,
        rosterEntryId,
        examQuestionId: item.examQuestionId,
        selectedKeys: item.selectedKeys,
      })),
    });
  });

  const agg = await prisma.answerDraft.aggregate({
    where: { examId, rosterEntryId },
    _max: { updatedAt: true },
  });

  return {
    answerCount: normalizedAnswers.length,
    maxDraftUpdatedAt: agg._max.updatedAt?.toISOString() ?? null,
  };
}

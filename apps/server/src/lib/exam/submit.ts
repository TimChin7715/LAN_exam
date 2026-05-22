import type { ExamContentModule, Prisma } from '@prisma/client';

import { assertStudentExamAccess } from './access.js';
import {
  requiresPracticalBatch,
  requiresQuestionSubmission,
} from './content-mode.js';
import { finalizePracticalSubmission } from './submit-practical.js';
import { finalizeFillInScreenshots } from '../fillin/finalize-screenshots.js';
import { scoreQuestion } from './score-question.js';
import { SubmitExamError } from './types.js';
import { prisma } from '../prisma.js';

export async function submitExam(
  input: { examId: string; rosterEntryId: string },
): Promise<{ totalScore: number | null; submittedAt: Date }> {
  const { examId, rosterEntryId } = input;

  await assertStudentExamAccess(rosterEntryId, examId, 'submit');

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { contentModules: true },
  });

  if (!exam) {
    throw new SubmitExamError(404, 'EXAM_NOT_FOUND', '考试不存在');
  }

  const modules = exam.contentModules;

  if (requiresQuestionSubmission(modules)) {
    const existingObjective = await prisma.submission.findUnique({
      where: { examId_rosterEntryId: { examId, rosterEntryId } },
      select: { id: true },
    });
    if (existingObjective) {
      throw new SubmitExamError(
        409,
        'ALREADY_SUBMITTED',
        '您已提交过本场考试，无法再次提交。',
      );
    }
  }

  if (requiresPracticalBatch(modules)) {
    const existingPractical = await prisma.practicalSubmission.findUnique({
      where: { examId_rosterEntryId: { examId, rosterEntryId } },
      select: { id: true },
    });
    if (existingPractical) {
      throw new SubmitExamError(
        409,
        'ALREADY_SUBMITTED',
        '您已提交过本场考试，无法再次提交。',
      );
    }
  }

  return prisma.$transaction(
    async (tx) => {
      let totalScore: number | null = null;
      let submittedAt = new Date();

      if (requiresQuestionSubmission(modules)) {
        const result = await submitScoredQuestionsPart(
          tx,
          examId,
          rosterEntryId,
        );
        totalScore = result.totalScore;
        submittedAt = result.submittedAt;
      }

      if (requiresPracticalBatch(modules)) {
        await finalizePracticalSubmission(tx, { examId, rosterEntryId });
        if (totalScore === null) {
          submittedAt = new Date();
        }
      }

      return { totalScore, submittedAt };
    },
    { timeout: 60_000 },
  );
}

async function submitScoredQuestionsPart(
  tx: Prisma.TransactionClient,
  examId: string,
  rosterEntryId: string,
): Promise<{ totalScore: number; submittedAt: Date }> {
  const examQuestions = await tx.examQuestion.findMany({
    where: { examId },
    orderBy: { sortOrder: 'asc' },
    include: {
      question: {
        include: {
          options: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });

  if (examQuestions.length === 0) {
    throw new SubmitExamError(
      400,
      'NO_QUESTIONS',
      '本场考试没有试题，无法提交。',
    );
  }

  const drafts = await tx.answerDraft.findMany({
    where: { examId, rosterEntryId },
    select: { examQuestionId: true, selectedKeys: true },
  });

  const draftByQuestionId = new Map(
    drafts.map((d) => [d.examQuestionId, d.selectedKeys]),
  );

  let totalScore = 0;
  const answerCreates: {
    examQuestionId: string;
    selectedKeys: string;
    isCorrect: boolean;
    pointsAwarded: number;
  }[] = [];

  for (const eq of examQuestions) {
    const optionKeys = eq.question.options.map((o) => o.key);
    const selectedRaw = draftByQuestionId.get(eq.id) ?? '';
    const scored = scoreQuestion(
      {
        type: eq.question.type,
        answerKeys: eq.question.answerKeys,
        points: eq.question.points,
        multiScoringRule: eq.question.multiScoringRule,
        optionKeys,
      },
      selectedRaw,
    );
    totalScore += scored.pointsAwarded;
    answerCreates.push({
      examQuestionId: eq.id,
      selectedKeys: scored.selectedKeys,
      isCorrect: scored.isCorrect,
      pointsAwarded: scored.pointsAwarded,
    });
  }

  const submission = await tx.submission.create({
    data: {
      examId,
      rosterEntryId,
      totalScore,
      answers: { create: answerCreates },
    },
    select: { id: true, totalScore: true, submittedAt: true },
  });

  await finalizeFillInScreenshots(tx, {
    examId,
    rosterEntryId,
    submissionId: submission.id,
  });

  await tx.answerDraft.deleteMany({
    where: { examId, rosterEntryId },
  });

  return {
    totalScore: submission.totalScore,
    submittedAt: submission.submittedAt,
  };
}

import type { ExamContentModule, Prisma } from '@prisma/client';

import {
  assertDeadlineSubmitAccess,
  assertStudentExamAccess,
} from './access.js';
import {
  requiresQuestionSubmission,
} from './content-mode.js';
import {
  getCachedScoreableQuestions,
  type ScoreableExamQuestion,
} from './exam-paper-cache.js';
import { loadExamPaperStatic } from './load-exam-paper.js';
import { finalizeFillInScreenshots } from '../fillin/finalize-screenshots.js';
import { scoreQuestion } from './score-question.js';
import { assertAnswersComplete } from './validate-answers-complete.js';
import { SubmitExamError } from './types.js';
import { prisma } from '../prisma.js';

export type SubmitMode = 'strict' | 'deadline';

export async function submitExam(
  input: {
    examId: string;
    rosterEntryId: string;
    mode?: SubmitMode;
  },
): Promise<{ totalScore: number | null; submittedAt: Date }> {
  const { examId, rosterEntryId } = input;
  const mode = input.mode ?? 'strict';

  if (mode === 'strict') {
    await assertStudentExamAccess(rosterEntryId, examId, 'submit');
  } else {
    await assertDeadlineSubmitAccess(rosterEntryId, examId);
  }

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
    await loadExamPaperStatic(examId);
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
          mode,
        );
        totalScore = result.totalScore;
        submittedAt = result.submittedAt;
      }

      return { totalScore, submittedAt };
    },
    { timeout: 60_000 },
  );
}

export function scoreQuestionsFromDrafts(
  scoreable: ScoreableExamQuestion[],
  draftByQuestionId: Map<string, string>,
  options: { requireComplete: boolean },
): {
  totalScore: number;
  answerCreates: {
    examQuestionId: string;
    selectedKeys: string;
    isCorrect: boolean;
    pointsAwarded: number;
  }[];
} {
  if (options.requireComplete) {
    const questionsForCheck = scoreable.map((q) => ({
      id: q.examQuestionId,
      question: { type: q.type },
    }));
    assertAnswersComplete(questionsForCheck, draftByQuestionId);
  }

  // Round scores to 0.5 steps to avoid floating artifacts and keep grading simple.
  const roundScore = (n: number): number =>
    Math.round((n + Number.EPSILON) * 2) / 2;

  let totalScore = 0;
  const answerCreates: {
    examQuestionId: string;
    selectedKeys: string;
    isCorrect: boolean;
    pointsAwarded: number;
  }[] = [];

  for (const q of scoreable) {
    const selectedRaw = draftByQuestionId.get(q.examQuestionId) ?? '';
    const scored = scoreQuestion(
      {
        type: q.type,
        answerKeys: q.answerKeys,
        points: q.points,
        multiScoringRule: q.multiScoringRule,
        optionKeys: q.optionKeys,
      },
      selectedRaw,
    );
    const pointsAwarded = roundScore(scored.pointsAwarded);
    totalScore = roundScore(totalScore + pointsAwarded);
    answerCreates.push({
      examQuestionId: q.examQuestionId,
      selectedKeys: scored.selectedKeys,
      isCorrect: scored.isCorrect,
      pointsAwarded,
    });
  }

  return { totalScore: roundScore(totalScore), answerCreates };
}

async function submitScoredQuestionsPart(
  tx: Prisma.TransactionClient,
  examId: string,
  rosterEntryId: string,
  _mode: SubmitMode,
): Promise<{ totalScore: number; submittedAt: Date }> {
  const requireComplete = false;
  const roundScore = (n: number): number =>
    Math.round((n + Number.EPSILON) * 2) / 2;

  const drafts = await tx.answerDraft.findMany({
    where: { examId, rosterEntryId },
    select: { examQuestionId: true, selectedKeys: true },
  });

  const draftByQuestionId = new Map(
    drafts.map((d) => [d.examQuestionId, d.selectedKeys]),
  );

  const cached = getCachedScoreableQuestions(examId);
  let totalScore: number;
  let answerCreates: {
    examQuestionId: string;
    selectedKeys: string;
    isCorrect: boolean;
    pointsAwarded: number;
  }[];

  if (cached && cached.length > 0) {
    ({ totalScore, answerCreates } = scoreQuestionsFromDrafts(
      cached,
      draftByQuestionId,
      { requireComplete },
    ));
  } else {
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

    if (requireComplete) {
      assertAnswersComplete(examQuestions, draftByQuestionId);
    }

    totalScore = 0;
    answerCreates = [];

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
      const pointsAwarded = roundScore(scored.pointsAwarded);
      totalScore = roundScore(totalScore + pointsAwarded);
      answerCreates.push({
        examQuestionId: eq.id,
        selectedKeys: scored.selectedKeys,
        isCorrect: scored.isCorrect,
        pointsAwarded,
      });
    }
  }

  if (answerCreates.length === 0) {
    throw new SubmitExamError(
      400,
      'NO_QUESTIONS',
      '本场考试没有试题，无法提交。',
    );
  }

  const submission = await tx.submission.create({
    data: {
      examId,
      rosterEntryId,
      totalScore: roundScore(totalScore),
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

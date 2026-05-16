import type { PrismaClient } from '@prisma/client';

import { assertStudentExamAccess } from './access.js';
import { scoreQuestion } from './score-question.js';
import { SubmitExamError } from './types.js';

export async function submitExam(
  prisma: PrismaClient,
  input: { examId: string; rosterEntryId: string },
): Promise<{ totalScore: number; submittedAt: Date }> {
  const { examId, rosterEntryId } = input;

  await assertStudentExamAccess(rosterEntryId, examId, 'submit');

  const existing = await prisma.submission.findUnique({
    where: {
      examId_rosterEntryId: { examId, rosterEntryId },
    },
    select: { id: true },
  });

  if (existing) {
    throw new SubmitExamError(
      409,
      'ALREADY_SUBMITTED',
      '您已提交过本场考试，无法再次提交。',
    );
  }

  return prisma.$transaction(
    async (tx) => {
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
        select: { totalScore: true, submittedAt: true },
      });

      await tx.answerDraft.deleteMany({
        where: { examId, rosterEntryId },
      });

      return {
        totalScore: submission.totalScore,
        submittedAt: submission.submittedAt,
      };
    },
    { timeout: 60_000 },
  );
}

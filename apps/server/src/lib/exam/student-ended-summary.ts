import type { ExamContentModule } from '@prisma/client';

import {
  requiresPracticalBatch,
  requiresQuestionSubmission,
} from './content-mode.js';
import { prisma } from '../prisma.js';

export type StudentEndedSummary = {
  examId: string;
  title: string;
  contentModules: ExamContentModule[];
  endedAt: string | null;
  submitted: boolean;
  totalScore: number | null;
};

export async function resolveStudentEndedSummary(
  rosterEntryId: string,
  examId: string,
): Promise<StudentEndedSummary | null> {
  const entry = await prisma.rosterEntry.findUnique({
    where: { id: rosterEntryId },
    select: { batchId: true },
  });
  if (!entry) return null;

  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      rosterBatchId: entry.batchId,
      status: 'ENDED',
    },
    select: {
      id: true,
      title: true,
      contentModules: true,
      endedAt: true,
    },
  });

  if (!exam) return null;

  const needsQuestions = requiresQuestionSubmission(exam.contentModules);
  const needsPrac = requiresPracticalBatch(exam.contentModules);

  const [objective, practical] = await Promise.all([
    needsQuestions
      ? prisma.submission.findUnique({
          where: {
            examId_rosterEntryId: { examId, rosterEntryId },
          },
          select: { totalScore: true },
        })
      : Promise.resolve(null),
    needsPrac
      ? prisma.practicalSubmission.findUnique({
          where: {
            examId_rosterEntryId: { examId, rosterEntryId },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const submitted =
    (!needsQuestions || Boolean(objective)) && (!needsPrac || Boolean(practical));

  return {
    examId: exam.id,
    title: exam.title,
    contentModules: exam.contentModules,
    endedAt: exam.endedAt?.toISOString() ?? null,
    submitted,
    totalScore: objective?.totalScore ?? null,
  };
}

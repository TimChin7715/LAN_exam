import type { ExamContentModule } from '@prisma/client';

import {
  requiresPracticalBatch,
  requiresQuestionSubmission,
} from './content-mode.js';
import { RetakeExamError } from './types.js';
import { prisma } from '../prisma.js';
import { deleteStorageTree } from '../storage/index.js';

function isStudentSubmitted(
  contentModules: ExamContentModule[],
  hasSubmission: boolean,
  hasPracticalSubmission: boolean,
): boolean {
  const questionsDone =
    !requiresQuestionSubmission(contentModules) || hasSubmission;
  const practicalDone =
    !requiresPracticalBatch(contentModules) || hasPracticalSubmission;
  return questionsDone && practicalDone;
}

export async function resetStudentExamSubmission(input: {
  examId: string;
  rosterEntryId: string;
  teacherId: string;
}): Promise<void> {
  const { examId, rosterEntryId, teacherId } = input;

  const exam = await prisma.exam.findFirst({
    where: { id: examId, teacherId },
    select: {
      id: true,
      status: true,
      rosterBatchId: true,
      contentModules: true,
    },
  });

  if (!exam) {
    throw new RetakeExamError(404, 'EXAM_NOT_FOUND', '考试不存在');
  }

  if (exam.status !== 'IN_PROGRESS') {
    throw new RetakeExamError(
      409,
      'EXAM_NOT_IN_PROGRESS',
      '仅进行中的考试允许重考。',
    );
  }

  const entry = await prisma.rosterEntry.findFirst({
    where: { id: rosterEntryId, batchId: exam.rosterBatchId },
    select: { id: true },
  });

  if (!entry) {
    throw new RetakeExamError(404, 'ROSTER_ENTRY_NOT_FOUND', '考生不存在');
  }

  const [submission, practicalSubmission] = await Promise.all([
    requiresQuestionSubmission(exam.contentModules)
      ? prisma.submission.findUnique({
          where: { examId_rosterEntryId: { examId, rosterEntryId } },
          select: { id: true },
        })
      : Promise.resolve(null),
    requiresPracticalBatch(exam.contentModules)
      ? prisma.practicalSubmission.findUnique({
          where: { examId_rosterEntryId: { examId, rosterEntryId } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (
    !isStudentSubmitted(
      exam.contentModules,
      Boolean(submission),
      Boolean(practicalSubmission),
    )
  ) {
    throw new RetakeExamError(
      409,
      'NOT_SUBMITTED',
      '该考生尚未提交试卷，无法重考。',
    );
  }

  await prisma.$transaction(async (tx) => {
    if (submission) {
      await tx.submission.delete({ where: { id: submission.id } });
    }
    if (practicalSubmission) {
      await tx.practicalSubmission.delete({
        where: { id: practicalSubmission.id },
      });
    }
    await tx.answerDraft.deleteMany({ where: { examId, rosterEntryId } });
    await tx.fillInScreenshotDraft.deleteMany({
      where: { examId, rosterEntryId },
    });
    await tx.practicalAnswerDraft.deleteMany({
      where: { examId, rosterEntryId },
    });
  });

  await deleteStorageTree(`exam-work/${examId}/${rosterEntryId}`);
}

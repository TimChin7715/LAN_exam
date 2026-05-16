import { prisma } from '../prisma.js';
import { ExamTransitionError } from './types.js';

export async function startExam(
  examId: string,
  teacherId: string,
): Promise<{ id: string; status: 'IN_PROGRESS'; startedAt: Date }> {
  return prisma.$transaction(
    async (tx) => {
      const exam = await tx.exam.findUnique({
        where: { id: examId },
        select: {
          id: true,
          status: true,
          teacherId: true,
          rosterBatchId: true,
        },
      });

      if (!exam) {
        throw new ExamTransitionError(404, 'EXAM_NOT_FOUND', '考试不存在');
      }

      if (exam.teacherId !== teacherId) {
        throw new ExamTransitionError(404, 'EXAM_NOT_FOUND', '考试不存在');
      }

      if (exam.status !== 'DRAFT') {
        throw new ExamTransitionError(
          409,
          'INVALID_STATUS',
          '仅草稿状态的考试可以开始',
        );
      }

      const questionCount = await tx.examQuestion.count({
        where: { examId },
      });
      if (questionCount === 0) {
        throw new ExamTransitionError(
          409,
          'NO_QUESTIONS',
          '考试尚未关联题目，无法开始',
        );
      }

      const rosterCount = await tx.rosterEntry.count({
        where: { batchId: exam.rosterBatchId },
      });
      if (rosterCount === 0) {
        throw new ExamTransitionError(
          409,
          'NO_ROSTER',
          '考试关联的名单批次没有考生，无法开始',
        );
      }

      const conflicting = await tx.exam.findFirst({
        where: {
          rosterBatchId: exam.rosterBatchId,
          status: 'IN_PROGRESS',
          id: { not: examId },
        },
        select: { id: true },
      });

      if (conflicting) {
        throw new ExamTransitionError(
          409,
          'ROSTER_BATCH_BUSY',
          '该名单批次已有进行中的考试',
        );
      }

      const updated = await tx.exam.update({
        where: { id: examId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
        },
      });

      return {
        id: updated.id,
        status: 'IN_PROGRESS' as const,
        startedAt: updated.startedAt!,
      };
    },
    { timeout: 30_000 },
  );
}

/** End exam lifecycle — implemented in phase 04-02. */
export async function endExam(
  _examId: string,
  _teacherId: string,
): Promise<never> {
  throw new ExamTransitionError(
    501,
    'NOT_IMPLEMENTED',
    '结束考试功能将在后续版本提供',
  );
}

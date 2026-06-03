import type { PrismaClient } from '@prisma/client';

import { listRosterInProgressExams } from './list-roster-in-progress-exams.js';

export type StudentInProgressExamStatus =
  | {
      status: 'choose_exam';
      exams: Array<{
        id: string;
        title: string;
        scheduledStartAt: string | null;
        scheduledEndAt: string | null;
      }>;
    }
  | {
      status: 'waiting';
      examId: string;
      title: string;
      scheduledStartAt: string;
    }
  | {
      status: 'IN_PROGRESS';
      examId: string;
      title: string;
      scheduledEndAt: string | null;
    }
  | {
      status: 'DEADLINE_REACHED';
      examId: string;
      title: string;
      scheduledEndAt: string;
    };

/**
 * Resolve status among IN_PROGRESS exams on the student's roster batch.
 * Returns null when no in-progress exam applies (caller handles ended / none).
 */
export async function resolveStudentInProgressExamStatus(
  prisma: PrismaClient,
  rosterBatchId: string,
  selectedExamId: string | undefined,
): Promise<StudentInProgressExamStatus | null> {
  const inProgress = await listRosterInProgressExams(prisma, rosterBatchId);
  const now = new Date();

  if (inProgress.length > 1 && !selectedExamId) {
    return {
      status: 'choose_exam',
      exams: inProgress.map((e) => ({
        id: e.id,
        title: e.title,
        scheduledStartAt: e.scheduledStartAt?.toISOString() ?? null,
        scheduledEndAt: e.scheduledEndAt?.toISOString() ?? null,
      })),
    };
  }

  let exam =
    selectedExamId != null
      ? inProgress.find((e) => e.id === selectedExamId)
      : undefined;

  if (!exam && inProgress.length === 1) {
    exam = inProgress[0];
  }

  if (!exam) {
    if (inProgress.length > 1) {
      return {
        status: 'choose_exam',
        exams: inProgress.map((e) => ({
          id: e.id,
          title: e.title,
          scheduledStartAt: e.scheduledStartAt?.toISOString() ?? null,
          scheduledEndAt: e.scheduledEndAt?.toISOString() ?? null,
        })),
      };
    }
    return null;
  }

  if (exam.scheduledStartAt && now < exam.scheduledStartAt) {
    return {
      status: 'waiting',
      examId: exam.id,
      title: exam.title,
      scheduledStartAt: exam.scheduledStartAt.toISOString(),
    };
  }
  if (exam.scheduledEndAt && now > exam.scheduledEndAt) {
    return {
      status: 'DEADLINE_REACHED',
      examId: exam.id,
      title: exam.title,
      scheduledEndAt: exam.scheduledEndAt.toISOString(),
    };
  }
  return {
    status: 'IN_PROGRESS',
    examId: exam.id,
    title: exam.title,
    scheduledEndAt: exam.scheduledEndAt?.toISOString() ?? null,
  };
}

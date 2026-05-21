export type StudentSeatDisplayStatus = 'not_started' | 'in_progress';

export function computeStudentSeatDisplayStatus(exam: {
  status: 'DRAFT' | 'IN_PROGRESS';
  scheduledStartAt: Date | null;
}): StudentSeatDisplayStatus {
  if (exam.status === 'DRAFT') {
    return 'not_started';
  }

  const now = new Date();
  if (exam.scheduledStartAt && now < exam.scheduledStartAt) {
    return 'not_started';
  }

  return 'in_progress';
}

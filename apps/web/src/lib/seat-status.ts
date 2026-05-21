export type StudentSeatDisplayStatus = 'not_started' | 'in_progress';

export function studentSeatStatusLabel(
  displayStatus: StudentSeatDisplayStatus,
): string {
  switch (displayStatus) {
    case 'not_started':
      return '未开始';
    case 'in_progress':
      return '进行中';
    default:
      return displayStatus;
  }
}

export type ExamQuestionRef = { id: string; sortOrder: number };

export type SummarySubmissionRef = {
  answers: { examQuestion: { id: string }; pointsAwarded: number }[];
};

/**
 * Per-question scores for 成绩汇总 wide columns (D-02–D-05).
 * Unsubmitted → all em-dash; submitted missing answer → 0.
 */
export function perQuestionScoresForSummary(
  examQuestions: ExamQuestionRef[],
  submission?: SummarySubmissionRef,
): (number | '—')[] {
  if (!submission) {
    return examQuestions.map(() => '—' as const);
  }
  const byId = new Map(
    submission.answers.map((a) => [a.examQuestion.id, a.pointsAwarded]),
  );
  return examQuestions.map((eq) => byId.get(eq.id) ?? 0);
}

/** Stable column keys `q_${examQuestion.id}` for ExcelJS addRow. */
export function buildSummaryRowQuestionFields(
  examQuestions: ExamQuestionRef[],
  submission?: SummarySubmissionRef,
): Record<string, number | '—'> {
  const scores = perQuestionScoresForSummary(examQuestions, submission);
  const fields: Record<string, number | '—'> = {};
  for (let i = 0; i < examQuestions.length; i++) {
    fields[`q_${examQuestions[i]!.id}`] = scores[i]!;
  }
  return fields;
}

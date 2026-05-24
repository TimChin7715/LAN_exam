import type { QuestionType } from '@prisma/client';

import { SubmitExamError } from './types.js';

function parseMultiKeys(raw: string): string[] {
  return raw
    .split(/[,\uFF0C\u3001\s]+/)
    .map((k) => k.trim().toUpperCase())
    .filter((k) => /^[A-Z]$/.test(k));
}

export function isAnswerComplete(
  type: QuestionType,
  selectedRaw: string,
): boolean {
  const trimmed = selectedRaw.trim();
  if (type === 'MULTI') {
    return parseMultiKeys(trimmed).length > 0;
  }
  return trimmed.length > 0;
}

export type ExamQuestionForAnswerCheck = {
  id: string;
  question: { type: QuestionType };
};

export function listUnansweredExamQuestionIds(
  examQuestions: ExamQuestionForAnswerCheck[],
  draftByQuestionId: Map<string, string>,
): string[] {
  return examQuestions
    .filter(
      (eq) =>
        !isAnswerComplete(
          eq.question.type,
          draftByQuestionId.get(eq.id) ?? '',
        ),
    )
    .map((eq) => eq.id);
}

export function assertAnswersComplete(
  examQuestions: ExamQuestionForAnswerCheck[],
  draftByQuestionId: Map<string, string>,
): void {
  const missing = listUnansweredExamQuestionIds(
    examQuestions,
    draftByQuestionId,
  );
  if (missing.length > 0) {
    throw new SubmitExamError(
      400,
      'INCOMPLETE_ANSWERS',
      '尚有题目未作答，请完成后再提交。',
    );
  }
}

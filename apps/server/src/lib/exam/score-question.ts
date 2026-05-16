import type { MultiScoringRule, QuestionType } from '@prisma/client';

import {
  normalizeAnswerKeys,
  splitAnswerTokens,
} from '../qbank/normalize-answer.js';

export type ScoreableQuestion = {
  type: QuestionType;
  answerKeys: string;
  points: number;
  multiScoringRule: MultiScoringRule | null;
  optionKeys: string[];
};

export type ScoreResult = {
  selectedKeys: string;
  isCorrect: boolean;
  pointsAwarded: number;
};

export function scoreQuestion(
  q: ScoreableQuestion,
  selectedRaw: string,
): ScoreResult {
  const trimmed = selectedRaw.trim();
  if (!trimmed) {
    return { selectedKeys: '', isCorrect: false, pointsAwarded: 0 };
  }

  if (q.type === 'MULTI') {
    const selectedNorm = splitAnswerTokens(trimmed).join(',');
    const answerNorm = splitAnswerTokens(q.answerKeys).join(',');
    const rule = q.multiScoringRule ?? 'ALL_OR_NOTHING';
    const isCorrect =
      rule === 'ALL_OR_NOTHING' && selectedNorm === answerNorm && answerNorm.length > 0;
    return {
      selectedKeys: selectedNorm,
      isCorrect,
      pointsAwarded: isCorrect ? q.points : 0,
    };
  }

  const normalizedSelected = normalizeAnswerKeys(
    q.type,
    trimmed,
    q.optionKeys,
  );
  const normalizedAnswer = normalizeAnswerKeys(
    q.type,
    q.answerKeys,
    q.optionKeys,
  );

  if (!normalizedSelected || !normalizedAnswer) {
    return {
      selectedKeys: normalizedSelected ?? trimmed,
      isCorrect: false,
      pointsAwarded: 0,
    };
  }

  const isCorrect = normalizedSelected === normalizedAnswer;
  return {
    selectedKeys: normalizedSelected,
    isCorrect,
    pointsAwarded: isCorrect ? q.points : 0,
  };
}

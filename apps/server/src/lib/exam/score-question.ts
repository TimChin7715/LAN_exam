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

type FillBlankSpec = { blankIndex: number; answers: string[] };

function normalizeFillText(text: string): string {
  return text.trim().toLowerCase();
}

function splitAcceptedAnswers(answerKeys: string): string[] {
  return answerKeys
    .split(/[|｜]/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map(normalizeFillText);
}

/**
 * 新格式：一行一空，answerKeys 为导入答题卡「答案」列（| 分隔可接受项），
 * 与 parse-answer-sheet 写入题库时一致。
 */
function scoreFillSingleBlank(
  answerKeys: string,
  selectedRaw: string,
  points: number,
): ScoreResult {
  const trimmed = selectedRaw.trim();
  if (!trimmed) {
    return { selectedKeys: '', isCorrect: false, pointsAwarded: 0 };
  }

  const norm = normalizeFillText(trimmed);
  const accepted = splitAcceptedAnswers(answerKeys);
  const isCorrect = accepted.length > 0 && accepted.includes(norm);

  return {
    selectedKeys: trimmed,
    isCorrect,
    pointsAwarded: isCorrect ? points : 0,
  };
}

/** 旧格式兼容：JSON 多空 + 学员 JSON 作答 */
function scoreFillLegacyJson(
  answerKeysJson: string,
  selectedRaw: string,
  points: number,
): ScoreResult {
  let blanks: FillBlankSpec[];
  try {
    blanks = JSON.parse(answerKeysJson) as FillBlankSpec[];
  } catch {
    return scoreFillSingleBlank(answerKeysJson, selectedRaw, points);
  }

  if (!Array.isArray(blanks) || blanks.length === 0) {
    return scoreFillSingleBlank(answerKeysJson, selectedRaw, points);
  }

  let selected: Record<string, string>;
  try {
    selected = JSON.parse(selectedRaw) as Record<string, string>;
  } catch {
    return { selectedKeys: selectedRaw, isCorrect: false, pointsAwarded: 0 };
  }

  let allCorrect = true;
  for (const blank of blanks) {
    const key = String(blank.blankIndex);
    const raw = selected[key] ?? '';
    const norm = normalizeFillText(raw);
    const accepted = (blank.answers ?? []).map(normalizeFillText);
    if (!norm || !accepted.includes(norm)) {
      allCorrect = false;
      break;
    }
  }

  return {
    selectedKeys: selectedRaw,
    isCorrect: allCorrect,
    pointsAwarded: allCorrect ? points : 0,
  };
}

function scoreFillQuestion(
  answerKeys: string,
  selectedRaw: string,
  points: number,
): ScoreResult {
  const trimmed = selectedRaw.trim();
  if (answerKeys.trim().startsWith('[')) {
    return scoreFillLegacyJson(answerKeys, trimmed, points);
  }
  if (trimmed.startsWith('{')) {
    return scoreFillLegacyJson(answerKeys, trimmed, points);
  }
  return scoreFillSingleBlank(answerKeys, trimmed, points);
}

export function scoreQuestion(
  q: ScoreableQuestion,
  selectedRaw: string,
): ScoreResult {
  const trimmed = selectedRaw.trim();
  if (!trimmed && q.type !== 'FILL') {
    return { selectedKeys: '', isCorrect: false, pointsAwarded: 0 };
  }

  if (q.type === 'FILL') {
    return scoreFillQuestion(q.answerKeys, trimmed, q.points);
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

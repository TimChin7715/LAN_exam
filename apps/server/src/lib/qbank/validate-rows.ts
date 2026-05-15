import type { MultiScoringRule, QuestionType } from '@prisma/client';

import { mapTypeText } from './parse-workbook.js';
import { normalizeAnswerKeys } from './normalize-answer.js';
import type { ParsedQuestion, RawRow, RowError } from './types.js';

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function validateRow(row: RawRow): { question?: ParsedQuestion; errors: RowError[] } {
  const errors: RowError[] = [];

  const type = mapTypeText(row.typeText);
  if (!type) {
    errors.push({
      row: row.rowNumber,
      column: '题型',
      message: `无法识别的题型「${row.typeText}」`,
    });
    return { errors };
  }

  if (!row.stem.trim()) {
    errors.push({
      row: row.rowNumber,
      column: '题干',
      message: '题干不能为空',
    });
  }

  const optionEntries = [...row.options.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (optionEntries.length === 0) {
    errors.push({
      row: row.rowNumber,
      column: 'A',
      message: '至少需要一个选项',
    });
  }

  const minOptions = type === 'JUDGE' ? 2 : 2;
  if (type !== 'JUDGE' && optionEntries.length < 2) {
    errors.push({
      row: row.rowNumber,
      column: 'A',
      message: '选择题至少需要两个选项',
    });
  } else if (type === 'JUDGE' && optionEntries.length < minOptions) {
    errors.push({
      row: row.rowNumber,
      column: 'A',
      message: '判断题需要正确/错误两个选项',
    });
  }

  const optionKeys = optionEntries.map(([key]) => key);
  const answerKeys = normalizeAnswerKeys(type, row.answerRaw, optionKeys);
  if (!answerKeys) {
    errors.push({
      row: row.rowNumber,
      column: '答案',
      message: '答案无效或不在选项范围内',
    });
  }

  if (type === 'SINGLE' && answerKeys && answerKeys.includes(',')) {
    errors.push({
      row: row.rowNumber,
      column: '答案',
      message: '单选题只能有一个正确答案',
    });
  }

  if (type === 'MULTI' && answerKeys) {
    const count = answerKeys.split(',').length;
    if (count < 2) {
      errors.push({
        row: row.rowNumber,
        column: '答案',
        message: '多选题至少需要两个正确答案',
      });
    }
  }

  const difficulty = parsePositiveInt(row.difficultyRaw, 1, 1, 5);
  if (difficulty === null) {
    errors.push({
      row: row.rowNumber,
      column: '难度',
      message: '难度须为 1–5 的整数',
    });
  }

  const points = parsePositiveInt(row.pointsRaw, 1, 1, 1000);
  if (points === null) {
    errors.push({
      row: row.rowNumber,
      column: '分值',
      message: '分值须为正整数',
    });
  }

  if (errors.length > 0) {
    return { errors };
  }

  const options = optionEntries.map(([key, text], index) => ({
    key,
    text,
    sortOrder: index,
  }));

  let multiScoringRule: MultiScoringRule | undefined;
  if (type === 'MULTI') {
    multiScoringRule = 'ALL_OR_NOTHING';
  }

  const question: ParsedQuestion = {
    rowNumber: row.rowNumber,
    type: type as QuestionType,
    stem: row.stem.trim(),
    answerKeys: answerKeys!,
    points: points!,
    difficulty: difficulty!,
    explanation: row.explanation?.trim() || undefined,
    knowledgePoints: row.knowledgePoints?.trim() || undefined,
    multiScoringRule,
    options,
  };

  return { question, errors: [] };
}

export type ValidateRowsResult = {
  questions: ParsedQuestion[];
  errors: RowError[];
};

export function validateRows(rows: RawRow[]): ValidateRowsResult {
  const questions: ParsedQuestion[] = [];
  const errors: RowError[] = [];

  for (const row of rows) {
    const result = validateRow(row);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    } else if (result.question) {
      questions.push(result.question);
    }
  }

  return { questions, errors };
}

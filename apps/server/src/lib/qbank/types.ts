import type { MultiScoringRule, QuestionType } from '@prisma/client';

export type QbankErrorCode =
  | 'INVALID_TEMPLATE'
  | 'ROW_LIMIT_EXCEEDED'
  | 'VALIDATION_ERROR';

export class QbankTemplateError extends Error {
  readonly code: QbankErrorCode;

  constructor(code: QbankErrorCode, message: string) {
    super(message);
    this.name = 'QbankTemplateError';
    this.code = code;
  }
}

export type RowError = {
  row: number;
  column?: string;
  message: string;
};

export type ParsedOption = {
  key: string;
  text: string;
  sortOrder: number;
};

export type ParsedQuestion = {
  rowNumber: number;
  type: QuestionType;
  stem: string;
  answerKeys: string;
  points: number;
  difficulty: number;
  explanation?: string;
  knowledgePoints?: string;
  multiScoringRule?: MultiScoringRule;
  options: ParsedOption[];
};

export type RawRow = {
  rowNumber: number;
  stem: string;
  typeText: string;
  answerRaw: string;
  explanation?: string;
  knowledgePoints?: string;
  difficultyRaw?: string;
  pointsRaw?: string;
  options: Map<string, string>;
};

export const REQUIRED_HEADERS = ['题干', '题型', '答案'] as const;

export const OPTION_HEADER_PATTERN = /^[A-Z]$/;

export const MAX_IMPORT_ROWS = 2000;

export const SHEET_NAME = '题库导入';

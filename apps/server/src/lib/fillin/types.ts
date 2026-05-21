import type { RowError } from '../qbank/types.js';

export type { RowError };

/** 唯一导入工作表 */
export const FILLIN_SHEET = '答题卡';

export const FILLIN_HEADERS = ['题号', '答案', '分值'] as const;

/** 下发学员的答题卡列（无答案/分值） */
export const FILLIN_STUDENT_HEADERS = ['题号', '作答区'] as const;

export type ParsedAnswerRow = {
  rowNumber: number;
  questionNo: number;
  answerText: string;
  points: number;
};

/** Excel 一行一空 */
export type ParsedFillInBlank = {
  rowNumber: number;
  questionNo: number;
  /** 同题号内从 1 递增 */
  blankIndex: number;
  stem: string;
  answerKeys: string;
  points: number;
};

export type WordQuestionSegment = {
  questionNo: number;
  stem: string;
};

import type { Cell, Worksheet } from 'exceljs';

/** 「答题卡」工作表中「答案」列（1-based 列号） */
export const FILLIN_ANSWER_COLUMN = 2;
export const FILLIN_INLINE_ANSWER_COLUMN = 3;

const TEXT_NUMFMT = '@';

/** 将「答案」列设为 Excel 文本格式，避免日期/前导零等被自动改写 */
export function applyFillInAnswerColumnTextFormat(
  sheet: Worksheet,
  column = FILLIN_ANSWER_COLUMN,
): void {
  sheet.getColumn(column).numFmt = TEXT_NUMFMT;
}

export function writeFillInAnswerCell(cell: Cell, value: string): void {
  cell.numFmt = TEXT_NUMFMT;
  cell.value = value;
}

export function addFillInAnswerSheetRow(
  sheet: Worksheet,
  questionNo: number,
  answer: string,
  points: number,
  options?: {
    stem?: string;
    answerColumn?: number;
  },
): void {
  const hasStem = options?.stem !== undefined;
  const row = sheet.addRow(
    hasStem ? [questionNo, options.stem, answer, points] : [questionNo, answer, points],
  );
  const answerColumn =
    options?.answerColumn ??
    (hasStem ? FILLIN_INLINE_ANSWER_COLUMN : FILLIN_ANSWER_COLUMN);
  writeFillInAnswerCell(row.getCell(answerColumn), answer);
}

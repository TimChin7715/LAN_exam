import type { Cell, Worksheet } from 'exceljs';

/** 「答题卡」工作表中「答案」列（1-based 列号） */
export const FILLIN_ANSWER_COLUMN = 2;

const TEXT_NUMFMT = '@';

/** 将「答案」列设为 Excel 文本格式，避免日期/前导零等被自动改写 */
export function applyFillInAnswerColumnTextFormat(sheet: Worksheet): void {
  sheet.getColumn(FILLIN_ANSWER_COLUMN).numFmt = TEXT_NUMFMT;
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
): void {
  const row = sheet.addRow([questionNo, answer, points]);
  writeFillInAnswerCell(row.getCell(FILLIN_ANSWER_COLUMN), answer);
}

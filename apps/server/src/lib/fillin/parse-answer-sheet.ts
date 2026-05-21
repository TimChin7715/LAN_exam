import ExcelJS from 'exceljs';

import {
  addFillInAnswerSheetRow,
  applyFillInAnswerColumnTextFormat,
} from './excel-answer-column.js';
import {
  getCellByHeader,
  headerIndexMap,
  loadSpreadsheet,
  SpreadsheetReadError,
} from '../spreadsheet/read-workbook.js';
import type { RowError } from './types.js';
import {
  FILLIN_HEADERS,
  FILLIN_SHEET,
  FILLIN_STUDENT_HEADERS,
  type ParsedAnswerRow,
  type ParsedFillInBlank,
} from './types.js';

function parseIntCell(text: string): number | null {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 与答题卡「答案」列一致：按 | 分隔多个可接受答案，仅 trim，不改写内容 */
function splitAcceptedAnswers(answerText: string): string[] {
  return answerText
    .split(/[|｜]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

export async function parseAnswerSheetRows(
  buffer: Buffer,
): Promise<{ rows: ParsedAnswerRow[]; errors: RowError[] }> {
  let allRows: string[][];
  try {
    ({ rows: allRows } = loadSpreadsheet(buffer, { sheetName: FILLIN_SHEET }));
  } catch (err) {
    const message =
      err instanceof SpreadsheetReadError
        ? err.message
        : '无法解析答题卡 Excel';
    return {
      rows: [],
      errors: [{ row: 0, message }],
    };
  }

  const headerRow = allRows[0] ?? [];
  const cols = headerIndexMap(headerRow);
  for (const h of FILLIN_HEADERS) {
    if (!cols.has(h)) {
      return {
        rows: [],
        errors: [{ row: 1, message: `「${FILLIN_SHEET}」表头缺少列：${h}` }],
      };
    }
  }

  const rows: ParsedAnswerRow[] = [];
  const errors: RowError[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i]!;
    const rowNumber = i + 1;
    const qText = getCellByHeader(row, cols, '题号');
    const answerText = getCellByHeader(row, cols, '答案');
    const pointsText = getCellByHeader(row, cols, '分值');

    if (!qText && !answerText && !pointsText) continue;

    const questionNo = parseIntCell(qText);
    if (questionNo == null) {
      errors.push({ row: rowNumber, column: '题号', message: '题号须为正整数' });
      continue;
    }
    if (!answerText) {
      errors.push({ row: rowNumber, column: '答案', message: '答案不能为空' });
      continue;
    }
    const points = parseInt(pointsText, 10);
    if (!Number.isFinite(points) || points < 0) {
      errors.push({ row: rowNumber, column: '分值', message: '分值须为非负整数' });
      continue;
    }
    if (splitAcceptedAnswers(answerText).length === 0) {
      errors.push({ row: rowNumber, column: '答案', message: '答案无效' });
      continue;
    }

    rows.push({
      rowNumber,
      questionNo,
      answerText,
      points,
    });
  }

  return { rows, errors };
}

/**
 * 由答题卡 Excel 生成空位（不校验 Word 题号；Word 试卷在考试端全文展示）。
 */
export function buildFillInBlanksFromAnswerSheet(
  answerRows: ParsedAnswerRow[],
): ParsedFillInBlank[] {
  const blankIndexByQuestion = new Map<number, number>();
  const blanks: ParsedFillInBlank[] = [];

  for (const row of answerRows) {
    const nextIdx = (blankIndexByQuestion.get(row.questionNo) ?? 0) + 1;
    blankIndexByQuestion.set(row.questionNo, nextIdx);

    const accepted = splitAcceptedAnswers(row.answerText);
    blanks.push({
      rowNumber: row.rowNumber,
      questionNo: row.questionNo,
      blankIndex: nextIdx,
      stem: '',
      answerKeys: accepted.join('|'),
      points: row.points,
    });
  }

  blanks.sort((a, b) => a.rowNumber - b.rowNumber);
  return blanks;
}

/** 考官导入用答题卡模板（「答案」列为文本格式） */
export async function buildFillInImportTemplateExcel(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(FILLIN_SHEET);
  sheet.addRow([...FILLIN_HEADERS]);
  applyFillInAnswerColumnTextFormat(sheet);
  addFillInAnswerSheetRow(sheet, 1, '示例答案A', 2);
  addFillInAnswerSheetRow(sheet, 1, '示例答案A|别名A', 2);
  addFillInAnswerSheetRow(sheet, 2, '2020-10-17', 3);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** 由答题卡生成学员可下载的 xlsx（题号 + 作答区，无答案/分值） */
export async function buildStudentAnswerSheetExcel(
  blanks: ParsedFillInBlank[],
): Promise<Buffer> {
  const out = new ExcelJS.Workbook();
  const sheet = out.addWorksheet(FILLIN_SHEET);
  sheet.addRow([...FILLIN_STUDENT_HEADERS]);
  for (const b of blanks) {
    sheet.addRow([b.questionNo, '']);
  }
  const buf = await out.xlsx.writeBuffer();
  return Buffer.from(buf);
}

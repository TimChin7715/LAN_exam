import ExcelJS from 'exceljs';

import {
  addFillInAnswerSheetRow,
  applyFillInAnswerColumnTextFormat,
  writeFillInAnswerCell,
} from './excel-answer-column.js';
import { parseNonNegativeScore } from '../parse-score.js';
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

    if (
      answerText.startsWith('【示例】') ||
      answerText.startsWith('【说明】')
    ) {
      continue;
    }

    const questionNo = parseIntCell(qText);
    if (questionNo == null) {
      errors.push({ row: rowNumber, column: '题号', message: '题号须为正整数' });
      continue;
    }
    if (!answerText) {
      errors.push({ row: rowNumber, column: '答案', message: '答案不能为空' });
      continue;
    }
    const points = parseNonNegativeScore(pointsText);
    if (points === null) {
      errors.push({
        row: rowNumber,
        column: '分值',
        message: '分值须为非负数字（上限 1000）',
      });
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

const FILLIN_INSTRUCTIONS_SHEET = '使用说明';

function addFillInInstructionsSheet(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet(FILLIN_INSTRUCTIONS_SHEET);
  sheet.getColumn(1).width = 80;

  const lines: { text: string; bold?: boolean }[] = [
    { text: '填空题导入 — 答题卡制作说明', bold: true },
    { text: '' },
    { text: '一、配套导入', bold: true },
    {
      text: '• Word 文件：完整试卷，考试端全文展示；不要求与答题卡逐题一一对应。',
    },
    { text: '• 本 Excel：答题卡，定义每空的题号、标准答案与分值。' },
    { text: '• 可选附件：在管理台导入时单独上传，供学员下载参考。' },
    { text: '' },
    { text: '二、工作表与表头', bold: true },
    {
      text: '• 答题卡数据须写在名为「答题卡」的工作表中（本模板已创建）。',
    },
    { text: '• 第 1 行为表头，列名固定为：题号、答案、分值（请勿修改列名）。' },
    { text: '' },
    { text: '三、一行一空', bold: true },
    { text: '• 每一行代表 Word 试卷中的一个空。' },
    {
      text: '• 同一题号填写多行，表示该题有多个空；行顺序即第 1 空、第 2 空……',
    },
    { text: '' },
    { text: '四、各列填写规则', bold: true },
    { text: '• 题号：正整数；建议与 Word 中题号一致，便于学员对照。' },
    {
      text: '• 答案：必填。多个可接受答案用英文竖线 | 分隔（全角 ｜ 也可）。',
    },
    {
      text: '• 分值：非负数字（可为小数，如 2.5）。客观填空部分将按此分值自动计分。',
    },
    {
      text: '• 答案列已设为文本格式，避免日期、前导零等被 Excel 自动改写。',
    },
    { text: '' },
    { text: '五、导入前请检查', bold: true },
    {
      text: '• 删除「答题卡」工作表中答案列以【示例】开头的行（模板自带示例）。',
    },
    {
      text: '• 可参考同目录示例：填空题导入示例-题目.docx、填空题导入示例-答题卡.xlsx。',
    },
    { text: '• 支持 .xls 与 .xlsx 格式。' },
  ];

  for (const { text, bold } of lines) {
    const row = sheet.addRow([text]);
    row.height = text ? 18 : 8;
    if (bold) {
      row.getCell(1).font = { bold: true };
    }
  }
}

/** 考官导入用答题卡模板（「答案」列为文本格式） */
export async function buildFillInImportTemplateExcel(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addFillInInstructionsSheet(wb);

  const sheet = wb.addWorksheet(FILLIN_SHEET);
  const headerRow = sheet.addRow([...FILLIN_HEADERS]);
  headerRow.font = { bold: true };
  applyFillInAnswerColumnTextFormat(sheet);

  const reminderRow = sheet.addRow([
    '',
    '【说明】请删除下方【示例】行后填写真实内容；详细规则见「使用说明」工作表',
    '',
  ]);
  writeFillInAnswerCell(
    reminderRow.getCell(2),
    '【说明】请删除下方【示例】行后填写真实内容；详细规则见「使用说明」工作表',
  );
  addFillInAnswerSheetRow(sheet, 1, '【示例】示例答案A', 2);
  addFillInAnswerSheetRow(sheet, 1, '【示例】示例答案A|别名A', 2);
  addFillInAnswerSheetRow(sheet, 2, '【示例】2020-10-17', 3);

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

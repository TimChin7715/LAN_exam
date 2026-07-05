import ExcelJS from 'exceljs';

import {
  addFillInAnswerSheetRow,
  applyFillInAnswerColumnTextFormat,
  FILLIN_INLINE_ANSWER_COLUMN,
  writeFillInAnswerCell,
} from './excel-answer-column.js';
import { blankInputSize } from './inline-input-html.js';
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
  FILLIN_STEM_HEADER,
  FILLIN_STUDENT_HEADERS,
  FILLIN_TEMPLATE_HEADERS,
  type ParsedAnswerRow,
  type ParsedFillInBlank,
} from './types.js';

const QUESTION_NO_HEADER = '题号';
const ANSWER_HEADER = '答案';
const POINTS_HEADER = '分值';
const FILLIN_STEM_HEADER_ALIASES = [
  FILLIN_STEM_HEADER,
  '题目',
  '完整题目',
  '试题',
] as const;
const SAMPLE_PREFIXES = ['【示例】', '【说明】'] as const;
const BLANK_MARKER_RE = /【\s*】/g;
const UNSUPPORTED_BLANK_MARKER_RULES = [
  { re: /_{2,}|＿{2,}/, example: '____' },
  { re: /（\s*）|\(\s*\)/, example: '（）' },
  { re: /\[\s*\]|［\s*］/, example: '[]' },
] as const;

function parseIntCell(text: string): number | null {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findHeader(
  cols: Map<string, number>,
  headers: readonly string[],
): string | null {
  return headers.find((h) => cols.has(h)) ?? null;
}

function getCellByAnyHeader(
  row: string[],
  cols: Map<string, number>,
  headers: readonly string[],
): string {
  const header = findHeader(cols, headers);
  return header ? getCellByHeader(row, cols, header) : '';
}

function isTemplateHelperText(text: string): boolean {
  return SAMPLE_PREFIXES.some((prefix) => text.startsWith(prefix));
}

/** 与答题卡「答案」列一致：按 | 分隔多个可接受答案，仅 trim，不改写内容 */
function splitAcceptedAnswers(answerText: string): string[] {
  return answerText
    .split(/[|｜]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

export function countFillInBlankMarkers(stem: string): number {
  return [...stem.matchAll(BLANK_MARKER_RE)].length;
}

function findUnsupportedBlankMarker(stem: string): string | null {
  for (const rule of UNSUPPORTED_BLANK_MARKER_RULES) {
    if (rule.re.test(stem)) {
      return rule.example;
    }
  }
  return null;
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
    const qText = getCellByHeader(row, cols, QUESTION_NO_HEADER);
    const stemText = getCellByAnyHeader(row, cols, FILLIN_STEM_HEADER_ALIASES);
    const answerText = getCellByHeader(row, cols, ANSWER_HEADER);
    const pointsText = getCellByHeader(row, cols, POINTS_HEADER);

    if (!qText && !stemText && !answerText && !pointsText) continue;

    if (isTemplateHelperText(answerText) || isTemplateHelperText(stemText)) {
      continue;
    }

    const questionNo = parseIntCell(qText);
    if (questionNo == null) {
      errors.push({ row: rowNumber, column: QUESTION_NO_HEADER, message: '题号须为正整数' });
      continue;
    }
    const unsupportedBlankMarker = stemText
      ? findUnsupportedBlankMarker(stemText)
      : null;
    if (unsupportedBlankMarker) {
      errors.push({
        row: rowNumber,
        column: FILLIN_STEM_HEADER,
        message: `题干中的空位只能使用【】；请不要使用 ${unsupportedBlankMarker}。`,
      });
      continue;
    }
    if (!answerText) {
      errors.push({ row: rowNumber, column: ANSWER_HEADER, message: '答案不能为空' });
      continue;
    }
    const points = parseNonNegativeScore(pointsText);
    if (points === null) {
      errors.push({
        row: rowNumber,
        column: POINTS_HEADER,
        message: '分值须为非负数字（上限 1000）',
      });
      continue;
    }
    if (splitAcceptedAnswers(answerText).length === 0) {
      errors.push({ row: rowNumber, column: ANSWER_HEADER, message: '答案无效' });
      continue;
    }

    rows.push({
      rowNumber,
      questionNo,
      stemText: stemText || undefined,
      answerText,
      points,
    });
  }

  return { rows, errors };
}

/**
 * 由答题卡 Excel 生成空位。新版 Excel 可在「题干」列携带完整题目；
 * 同题号多空时，题干可只写在任意一行，会传播到该题所有空位。
 */
export function buildFillInBlanksFromAnswerSheet(
  answerRows: ParsedAnswerRow[],
): ParsedFillInBlank[] {
  const blankIndexByQuestion = new Map<number, number>();
  const stemByQuestion = new Map<number, string>();
  const blanks: ParsedFillInBlank[] = [];

  for (const row of answerRows) {
    const stem = row.stemText?.trim();
    if (stem && !stemByQuestion.has(row.questionNo)) {
      stemByQuestion.set(row.questionNo, stem);
    }
  }

  for (const row of answerRows) {
    const nextIdx = (blankIndexByQuestion.get(row.questionNo) ?? 0) + 1;
    blankIndexByQuestion.set(row.questionNo, nextIdx);

    const accepted = splitAcceptedAnswers(row.answerText);
    blanks.push({
      rowNumber: row.rowNumber,
      questionNo: row.questionNo,
      blankIndex: nextIdx,
      stem: row.stemText?.trim() || stemByQuestion.get(row.questionNo) || '',
      answerKeys: accepted.join('|'),
      points: row.points,
    });
  }

  blanks.sort((a, b) => a.rowNumber - b.rowNumber);
  return blanks;
}

type InlineBlank = ParsedFillInBlank & {
  inlineOrder: number;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderText(text: string): string {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>');
}

function renderInlineInput(blank: InlineBlank): string {
  const label = `第 ${blank.questionNo} 题第 ${blank.blankIndex} 空`;
  const size = blankInputSize(blank.answerKeys);
  return [
    '<input',
    ' class="fillin-inline-input"',
    ' type="text"',
    ' autocomplete="off"',
    ` size="${size}"`,
    ` aria-label="${escapeHtml(label)}"`,
    ` data-fillin-order="${blank.inlineOrder}"`,
    ` data-fillin-question-no="${blank.questionNo}"`,
    ` data-fillin-blank-index="${blank.blankIndex}"`,
    ' />',
  ].join('');
}

function renderStemWithInputs(stem: string, blanks: InlineBlank[]): string {
  BLANK_MARKER_RE.lastIndex = 0;
  let html = '';
  let cursor = 0;
  let blankCursor = 0;

  for (const match of stem.matchAll(BLANK_MARKER_RE)) {
    const index = match.index ?? 0;
    html += renderText(stem.slice(cursor, index));
    const blank = blanks[blankCursor];
    html += blank
      ? renderInlineInput(blank)
      : '<span class="fillin-inline-blank"></span>';
    blankCursor += 1;
    cursor = index + match[0].length;
  }

  html += renderText(stem.slice(cursor));

  if (blankCursor < blanks.length) {
    const missingInputs = blanks
      .slice(blankCursor)
      .map((blank) => renderInlineInput(blank))
      .join('');
    html += `<span class="fillin-inline-extra">${missingInputs}</span>`;
  }

  return html;
}

export function buildFillInInlinePreviewHtml(
  blanks: ParsedFillInBlank[],
): string {
  const ordered = [...blanks].sort((a, b) => a.rowNumber - b.rowNumber);
  const groups = new Map<number, InlineBlank[]>();

  ordered.forEach((blank, inlineOrder) => {
    const list = groups.get(blank.questionNo) ?? [];
    list.push({ ...blank, inlineOrder });
    groups.set(blank.questionNo, list);
  });

  const questionHtml = [...groups.entries()]
    .map(([questionNo, group]) => {
      const stem = group.find((b) => b.stem.trim())?.stem.trim() ?? '';
      const fallbackStem = stem || `第 ${questionNo} 题`;
      const totalPoints = group.reduce((sum, blank) => sum + blank.points, 0);
      const pointsLabel =
        Number.isInteger(totalPoints) ? String(totalPoints) : String(totalPoints);
      return [
        '<section class="fillin-inline-question">',
        `<p class="fillin-inline-title">第 ${questionNo} 题<span class="fillin-inline-points"> · ${pointsLabel} 分</span></p>`,
        `<div class="fillin-inline-stem">${renderStemWithInputs(fallbackStem, group)}</div>`,
        '</section>',
      ].join('');
    })
    .join('');

  return [
    '<style>',
    '.fillin-inline-paper{display:flex;flex-direction:column;gap:1.5rem;}',
    '.fillin-inline-question{break-inside:avoid;padding:1.25rem 1.5rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;box-shadow:0 1px 2px rgb(0 0 0 / 0.05);}',
    '.fillin-inline-title{margin:0 0 .75rem;font-size:1.25rem;font-weight:600;}',
    '.fillin-inline-points{margin-left:.375rem;font-size:1rem;font-weight:500;color:#64748b;}',
    '.fillin-inline-blank-points{margin-right:.375rem;font-size:.875rem;font-weight:600;color:#64748b;vertical-align:baseline;}',
    '.fillin-inline-stem{font-size:15px;line-height:2.35;}',
    '.fillin-inline-input{box-sizing:content-box;display:inline;width:auto;min-width:4ch;max-width:min(24rem,80vw);height:auto;margin:0;padding:.1em .35em;border:1px solid #fde047;border-radius:.125rem;background:#fef9c3;color:inherit;font:inherit;font-weight:inherit;line-height:inherit;vertical-align:baseline;outline:none;cursor:text;field-sizing:content;}',
    '.fillin-inline-input:hover{border-color:#facc15;background:#fef08a;}',
    '.fillin-inline-input:focus{border-color:#2563eb;background:#fef08a;box-shadow:0 0 0 2px rgb(37 99 235 / 16%);}',
    '.fillin-inline-input:disabled{border-color:#fde68a;background:#fef3c7;color:#475569;cursor:not-allowed;}',
    '.fillin-inline-blank{display:inline-block;min-width:8rem;border-bottom:1.5px solid currentColor;}',
    '.fillin-inline-extra{display:inline-flex;flex-wrap:wrap;gap:.35rem;margin-left:.5rem;vertical-align:baseline;}',
    '</style>',
    '<div class="fillin-inline-paper">',
    questionHtml || '<p class="text-muted">试卷正文为空。</p>',
    '</div>',
  ].join('');
}

const FILLIN_INSTRUCTIONS_SHEET = '使用说明';

function addFillInInstructionsSheet(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet(FILLIN_INSTRUCTIONS_SHEET);
  sheet.getColumn(1).width = 88;

  const lines: { text: string; bold?: boolean }[] = [
    { text: '操作题导入模板', bold: true },
    { text: '' },
    { text: '怎么填：', bold: true },
    {
      text: '1. 只需要这一个 Excel，就能导入操作题。Word 可以不传。',
    },
    {
      text: '2. 只改「答题卡」工作表，每一行都要填写：题号、题干、答案、分值。',
    },
    {
      text: '3. 题干里的留空只能写【】。不要写 ____、（）、() 或 []。例如：我国的首都是【】。',
    },
    {
      text: '4. 一行代表一个空。同一题有几个空，就用同一个题号写几行，题干里也写几个【】。',
    },
    {
      text: '5. 一个空如果支持多个答案，就用 | 分开。例如：唐|唐朝。',
    },
    {
      text: '6. 分值是这个空的分数，可以写整数或小数。',
    },
    { text: '' },
    { text: '多空题示例：', bold: true },
    {
      text: '题干：《静夜思》的作者是【】，朝代是【】。',
    },
    {
      text: '第 1 行答案写：李白；第 2 行答案写：唐|唐朝。两行题号都写 5。',
    },
    { text: '' },
    { text: '导入前检查：', bold: true },
    {
      text: '• 删除下面以【示例】或【说明】开头的行，再填写真实题目。',
    },
    {
      text: '• 题干里的空位数量，要和同一题号的答案行数一致。',
    },
    { text: '• 支持 .xls 与 .xlsx 格式。' },
  ];

  for (const { text, bold } of lines) {
    const row = sheet.addRow([text]);
    row.height = text ? 18 : 8;
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    if (bold) {
      row.getCell(1).font = { bold: true };
    }
  }
}

/** 考官导入用模板（新版题干 + 答案文本格式） */
export async function buildFillInImportTemplateExcel(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  addFillInInstructionsSheet(wb);

  const sheet = wb.addWorksheet(FILLIN_SHEET);
  sheet.columns = [
    { width: 10 },
    { width: 64 },
    { width: 24 },
    { width: 10 },
  ];
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const headerRow = sheet.addRow([...FILLIN_TEMPLATE_HEADERS]);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
  applyFillInAnswerColumnTextFormat(sheet, FILLIN_INLINE_ANSWER_COLUMN);

  const reminderRow = sheet.addRow([
    '',
    '【说明】请先删除下方【示例】行，再填写真实题目；题干留空只能写【】',
    '',
    '',
  ]);
  reminderRow.getCell(2).alignment = { wrapText: true };

  addFillInAnswerSheetRow(sheet, 1, '北京', 2, {
    stem: '【示例】中国的首都是【】。',
  });
  addFillInAnswerSheetRow(sheet, 2, '2020-10-17|2020/10/17', 3, {
    stem: '【示例】本系统上线日期为【】。',
  });
  addFillInAnswerSheetRow(sheet, 3, '00123', 2.5, {
    stem: '【示例】编号【】对应的设备需要检查。',
  });

  for (let r = 1; r <= sheet.rowCount; r += 1) {
    sheet.getRow(r).eachCell((cell) => {
      cell.alignment = { ...cell.alignment, wrapText: true, vertical: 'top' };
    });
  }
  writeFillInAnswerCell(reminderRow.getCell(3), '');

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

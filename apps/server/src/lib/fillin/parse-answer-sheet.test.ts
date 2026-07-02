import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';

import {
  addFillInAnswerSheetRow,
  applyFillInAnswerColumnTextFormat,
} from './excel-answer-column.js';
import {
  buildFillInInlinePreviewHtml,
  buildFillInBlanksFromAnswerSheet,
  buildFillInImportTemplateExcel,
  countFillInBlankMarkers,
  parseAnswerSheetRows,
} from './parse-answer-sheet.js';
import {
  FILLIN_HEADERS,
  FILLIN_SHEET,
  FILLIN_TEMPLATE_HEADERS,
} from './types.js';

async function buildSampleAnswerSheet(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(FILLIN_SHEET);
  sheet.addRow([...FILLIN_HEADERS]);
  applyFillInAnswerColumnTextFormat(sheet);
  addFillInAnswerSheetRow(sheet, 1, '2020-10-17', 5);
  addFillInAnswerSheetRow(sheet, 1, '00123', 5);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe('parseAnswerSheetRows', () => {
  it('reads ?? as displayed text (date and leading zeros)', async () => {
    const buffer = await buildSampleAnswerSheet();
    const { rows, errors } = await parseAnswerSheetRows(buffer);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.answerText, '2020-10-17');
    assert.equal(rows[1]!.answerText, '00123');
  });

  it('stores answerKeys from answer sheet without word match', async () => {
    const buffer = await buildSampleAnswerSheet();
    const { rows } = await parseAnswerSheetRows(buffer);
    const blanks = buildFillInBlanksFromAnswerSheet(rows);
    assert.equal(blanks.length, 2);
    assert.equal(blanks[0]!.answerKeys, '2020-10-17');
    assert.equal(blanks[1]!.answerKeys, '00123');
    assert.equal(blanks[0]!.questionNo, 1);
    assert.equal(blanks[1]!.blankIndex, 2);
  });

  it('reads modern Excel-only rows with 题干 and propagates stems by question', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(FILLIN_SHEET);
    sheet.addRow([...FILLIN_TEMPLATE_HEADERS]);
    applyFillInAnswerColumnTextFormat(sheet, 3);
    addFillInAnswerSheetRow(sheet, 1, '北京', 2, {
      stem: '中国的首都是【】，直辖市之一是【】。',
    });
    addFillInAnswerSheetRow(sheet, 1, '上海', 2, { stem: '' });
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const { rows, errors } = await parseAnswerSheetRows(buffer);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(rows.length, 2);

    const blanks = buildFillInBlanksFromAnswerSheet(rows);
    assert.equal(blanks[0]!.stem, '中国的首都是【】，直辖市之一是【】。');
    assert.equal(blanks[1]!.stem, '中国的首都是【】，直辖市之一是【】。');
    assert.equal(blanks[1]!.blankIndex, 2);
  });

  it('builds inline preview inputs for each imported blank', async () => {
    const blanks = buildFillInBlanksFromAnswerSheet([
      {
        rowNumber: 2,
        questionNo: 1,
        stemText: '中国的首都是【】，直辖市之一是【】。',
        answerText: '北京',
        points: 2,
      },
      {
        rowNumber: 3,
        questionNo: 1,
        answerText: '上海',
        points: 2,
      },
    ]);

    const html = buildFillInInlinePreviewHtml(blanks);
    assert.match(html, /class="fillin-inline-input"/);
    assert.match(html, /fillin-inline-points/);
    assert.match(html, / · 4 分/);
    assert.match(html, /data-fillin-question-no="1"/);
    assert.match(html, /data-fillin-blank-index="2"/);
  });

  it('only treats 【】 as inline blank markers', () => {
    assert.equal(countFillInBlankMarkers('中国的首都是【】。'), 1);
    assert.equal(countFillInBlankMarkers('中国的首都是____。'), 0);
    assert.equal(countFillInBlankMarkers('中国的首都是（ ）。'), 0);
  });

  it('rejects unsupported blank marker styles in stem', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(FILLIN_SHEET);
    sheet.addRow([...FILLIN_TEMPLATE_HEADERS]);
    applyFillInAnswerColumnTextFormat(sheet, 3);
    addFillInAnswerSheetRow(sheet, 1, '北京', 2, {
      stem: '中国的首都是____。',
    });
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const { rows, errors } = await parseAnswerSheetRows(buffer);
    assert.equal(rows.length, 0);
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.column, '题干');
    assert.match(errors[0]!.message, /只能使用【】/);
  });

  it('skips rows with 【示例】 or 【说明】 in 答案 column', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(FILLIN_SHEET);
    sheet.addRow([...FILLIN_HEADERS]);
    applyFillInAnswerColumnTextFormat(sheet);
    addFillInAnswerSheetRow(sheet, 1, '【说明】请删除示例行', 0);
    addFillInAnswerSheetRow(sheet, 1, '【示例】示例答案', 2);
    addFillInAnswerSheetRow(sheet, 2, '真实答案', 3);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const { rows, errors } = await parseAnswerSheetRows(buffer);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.answerText, '真实答案');
    assert.equal(rows[0]!.questionNo, 2);
  });

  it('accepts decimal points', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(FILLIN_SHEET);
    sheet.addRow([...FILLIN_HEADERS]);
    applyFillInAnswerColumnTextFormat(sheet);
    addFillInAnswerSheetRow(sheet, 1, '答案A', 2.5);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const { rows, errors } = await parseAnswerSheetRows(buffer);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.points, 2.5);
  });

  it('official import template has no importable rows', async () => {
    const buffer = await buildFillInImportTemplateExcel();
    const { rows, errors } = await parseAnswerSheetRows(buffer);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(rows.length, 0);
  });
});

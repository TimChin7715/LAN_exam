import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';

import {
  addFillInAnswerSheetRow,
  applyFillInAnswerColumnTextFormat,
} from './excel-answer-column.js';
import {
  buildFillInBlanksFromAnswerSheet,
  parseAnswerSheetRows,
} from './parse-answer-sheet.js';
import { FILLIN_HEADERS, FILLIN_SHEET } from './types.js';

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
});

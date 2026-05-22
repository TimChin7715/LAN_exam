/**
 * Verifies .xls spreadsheet read and Word parse paths.
 * Run: pnpm exec tsx apps/server/scripts/verify-legacy-formats.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

import { parseAnswerSheetRows } from '../src/lib/fillin/parse-answer-sheet.ts';
import { parseWordQuestions } from '../src/lib/fillin/parse-word.ts';
import { loadSpreadsheet } from '../src/lib/spreadsheet/read-workbook.ts';
import { parseWorkbook as parseRoster } from '../src/lib/roster/parse-workbook.ts';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

const rosterXlsx = path.join(root, 'fixtures/import-test/名单导入-测试.xlsx');
const fillinXlsx = path.join(root, 'templates/填空题导入模板.xlsx');
const fillinDocx = path.join(root, 'templates/填空题导入示例-题目.docx');

function writeXlsFromXlsx(xlsxPath, xlsPath) {
  const buf = fs.readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const out = XLSX.write(wb, { bookType: 'xls', type: 'buffer' });
  fs.writeFileSync(xlsPath, out);
}

const tmpDir = path.join(root, 'fixtures/import-test');
const rosterXls = path.join(tmpDir, '名单导入-测试.xls');
if (fs.existsSync(rosterXlsx) && !fs.existsSync(rosterXls)) {
  writeXlsFromXlsx(rosterXlsx, rosterXls);
  console.log('Wrote', rosterXls);
}

const rosterBuf = fs.readFileSync(rosterXls);
const loaded = loadSpreadsheet(rosterBuf);
console.log('loadSpreadsheet xls rows:', loaded.rows.length);

const roster = await parseRoster(rosterBuf);
console.log('parseRoster xls entries:', roster.rows.length);

const fillinBuf = fs.readFileSync(fillinXlsx);
const fillinRows = await parseAnswerSheetRows(fillinBuf);
console.log('parseAnswerSheet xlsx blanks:', fillinRows.rows.length, 'errors:', fillinRows.errors.length);

if (fs.existsSync(fillinDocx)) {
  const wordBuf = fs.readFileSync(fillinDocx);
  const segs = await parseWordQuestions(wordBuf, '填空题导入示例-题目.docx');
  console.log('parseWord docx segments:', segs.length);
}

console.log('OK');

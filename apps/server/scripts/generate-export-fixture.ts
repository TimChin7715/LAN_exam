/**
 * Generates fixtures/export/test1-成绩导出.xlsx (synthetic D-07 sample).
 * Uses masked IDs only — replace with school file when available.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ExcelJS from 'exceljs';

import {
  buildSummarySheetColumns,
  FILL_IN_DETAIL_HEADERS,
  OBJECTIVE_DETAIL_HEADERS,
  type SummaryExamQuestion,
} from '../src/lib/exam/export-workbook.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const outDir = join(root, 'fixtures/export');
const outPath = join(outDir, 'test1-成绩导出.xlsx');

const examQuestions: SummaryExamQuestion[] = [
  {
    id: 'sample-eq1',
    sortOrder: 0,
    type: 'SINGLE',
    fillQuestionNo: null,
    fillBlankIndex: null,
  },
  {
    id: 'sample-eq2',
    sortOrder: 1,
    type: 'SINGLE',
    fillQuestionNo: null,
    fillBlankIndex: null,
  },
];

mkdirSync(outDir, { recursive: true });

const wb = new ExcelJS.Workbook();
wb.creator = 'LAN Exam';

const summary = wb.addWorksheet('成绩汇总');
summary.columns = buildSummarySheetColumns(examQuestions);
summary.getRow(1).font = { bold: true };
summary.addRow({
  name: '示例学生',
  organization: '示例单位',
  id: '110101********1234',
  score: 3,
  submitted: '已提交',
  time: '2026-05-17 10:00',
  [`q_${examQuestions[0]!.id}`]: 2,
  [`q_${examQuestions[1]!.id}`]: 1,
});

const detail = wb.addWorksheet('答题明细');
detail.columns = OBJECTIVE_DETAIL_HEADERS.map((header, i) => ({
  header,
  key: [
    'name',
    'organization',
    'id',
    'num',
    'type',
    'selected',
    'correct',
    'right',
    'points',
  ][i]!,
  width: 10,
}));
detail.getRow(1).font = { bold: true };

const fillIn = wb.addWorksheet('操作题明细');
fillIn.columns = FILL_IN_DETAIL_HEADERS.map((header, i) => ({
  header,
  key: [
    'name',
    'organization',
    'id',
    'num',
    'fillNo',
    'blank',
    'selected',
    'correct',
    'right',
    'points',
    'maxPoints',
  ][i]!,
  width: 10,
}));
fillIn.getRow(1).font = { bold: true };

await wb.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath}`);

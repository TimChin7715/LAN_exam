/**
 * Generates fixtures/export/test1-成绩导出.xlsx (synthetic D-07 sample).
 * Uses masked IDs only — replace with school file when available.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ExcelJS from 'exceljs';

import { buildSummarySheetColumns } from '../src/lib/exam/export-workbook.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const outDir = join(root, 'fixtures/export');
const outPath = join(outDir, 'test1-成绩导出.xlsx');

const examQuestions = [
  { id: 'sample-eq1', sortOrder: 0 },
  { id: 'sample-eq2', sortOrder: 1 },
];

mkdirSync(outDir, { recursive: true });

const wb = new ExcelJS.Workbook();
wb.creator = 'LAN Exam';

const summary = wb.addWorksheet('成绩汇总');
summary.columns = buildSummarySheetColumns(examQuestions);
summary.getRow(1).font = { bold: true };
summary.addRow({
  name: '示例学生',
  id: '110101********1234',
  score: 3,
  submitted: '已提交',
  time: '2026-05-17 10:00',
  [`q_${examQuestions[0]!.id}`]: 2,
  [`q_${examQuestions[1]!.id}`]: 1,
});

const detail = wb.addWorksheet('答题明细');
detail.columns = [
  { header: '姓名', key: 'name', width: 16 },
  { header: '身份证号', key: 'id', width: 22 },
  { header: '题号', key: 'num', width: 8 },
  { header: '题型', key: 'type', width: 10 },
  { header: '所选', key: 'selected', width: 16 },
  { header: '正确答案', key: 'correct', width: 16 },
  { header: '对错', key: 'right', width: 8 },
  { header: '得分', key: 'points', width: 8 },
];
detail.getRow(1).font = { bold: true };

await wb.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath}`);

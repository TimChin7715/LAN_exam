import { readFileSync } from 'node:fs';
import { parseWorkbook } from '../dist/lib/roster/parse-workbook.js';
import { validateRows } from '../dist/lib/roster/validate-rows.js';
import { isValidNationalIdFormat } from '../dist/lib/roster/national-id.js';
import { prisma } from '../dist/lib/prisma.js';
import ExcelJS from 'exceljs';

const path = process.argv[2] ?? 'C:/Users/23891/Desktop/名单导入-测试.xlsx';
const buf = readFileSync(path);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
const sheet = wb.getWorksheet('名单导入');
const row3 = sheet?.getRow(3);
if (row3) {
  const idCell = row3.getCell(2);
  console.log('cell3 type', typeof idCell.value, 'value', idCell.value, 'text', idCell.text, 'numFmt', idCell.numFmt);
}

const parsed = await parseWorkbook(buf);
console.log('parsed rows', parsed.rows.length);
for (const r of parsed.rows.slice(0, 3)) {
  console.log('row', r.rowNumber, r.fullName, r.nationalId, 'valid', isValidNationalIdFormat(r.nationalId.trim()));
}

const v = await validateRows(parsed.rows);
console.log('entries', v.entries.length, 'errors', v.errors.length);
if (v.errors.length) {
  const byMsg = {};
  for (const e of v.errors) {
    byMsg[e.message] = (byMsg[e.message] ?? 0) + 1;
  }
  console.log('error summary', byMsg);
  console.log('first errors', v.errors.slice(0, 5));
}

await prisma.$disconnect();

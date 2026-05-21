/**
 * Generate a 60-person roster workbook from Desktop template.
 * Usage: node scripts/generate-roster-60-desktop.mjs
 */
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const templatePath = 'C:/Users/23891/Desktop/名单导入模板.xlsx';
const outPath = 'C:/Users/23891/Desktop/名单导入-60人.xlsx';

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK_CHARS = '10X98765432';

function makeNationalId(body17) {
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(body17[i]) * WEIGHTS[i];
  return body17 + CHECK_CHARS[sum % 11];
}

function cellText(cell) {
  if (!cell?.value) return '';
  const v = cell.value;
  if (typeof v === 'object' && 'text' in v) return String(v.text ?? '').trim();
  if (typeof v === 'object' && 'richText' in v) {
    return v.richText.map((p) => p.text).join('').trim();
  }
  return String(v).trim();
}

function headerMap(sheet) {
  const map = new Map();
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    const name = cellText(cell);
    if (name) map.set(name, col);
  });
  return map;
}

function setByHeader(row, map, header, value, options = {}) {
  const col = map.get(header);
  if (!col) throw new Error(`missing column: ${header}`);
  const cell = row.getCell(col);
  if (options.asText) {
    cell.value = String(value);
    cell.numFmt = '@';
  } else {
    cell.value = value;
  }
}

const surnames = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
];
const givenNames = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀', '霞', '平',
  '刚', '桂', '英', '华', '鹏', '飞', '波', '斌', '浩', '凯',
];

function buildRosterRows(count) {
  const rows = [];
  for (let i = 1; i <= count; i += 1) {
    const surname = surnames[(i - 1) % surnames.length];
    const given = givenNames[Math.floor((i - 1) / surnames.length) % givenNames.length];
    const fullName = `${surname}${given}${i}`;
    const day = String(((i - 1) % 28) + 1).padStart(2, '0');
    const seq = String(i).padStart(3, '0');
    const body17 = `110101199506${day}${seq}`;
    rows.push([fullName, `测试单位${((i - 1) % 5) + 1}`, makeNationalId(body17)]);
  }
  return rows;
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(readFileSync(templatePath));
const sheet = wb.getWorksheet('名单导入');
if (!sheet) throw new Error('missing sheet 名单导入');

const headers = headerMap(sheet);
let rowNum = sheet.rowCount;
for (const [name, organization, id] of buildRosterRows(60)) {
  rowNum += 1;
  const row = sheet.getRow(rowNum);
  setByHeader(row, headers, '姓名', name);
  setByHeader(row, headers, '单位', organization);
  setByHeader(row, headers, '身份证号', id, { asText: true });
}

await wb.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath} (60 candidates, template row 2 example kept)`);

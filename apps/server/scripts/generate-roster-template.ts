import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ExcelJS from 'exceljs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const outPath = join(root, 'docs/templates/名单导入模板.xlsx');

async function main(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('名单导入');

  sheet.columns = [
    { header: '姓名', key: 'name', width: 16 },
    { header: '身份证号', key: 'id', width: 22 },
  ];

  sheet.getRow(1).font = { bold: true };

  const idCell = sheet.getCell('B2');
  idCell.value = '11010519491231002X';
  idCell.numFmt = '@';

  sheet.getCell('A2').value =
    '【示例】请删除本行后填写真实考生信息；姓名与身份证号须与证件一致（除首尾空格外须完全一致）';

  const outDir = dirname(outPath);
  mkdirSync(outDir, { recursive: true });
  await workbook.xlsx.writeFile(outPath);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

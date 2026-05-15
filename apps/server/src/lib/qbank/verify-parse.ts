import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseWorkbook } from './parse-workbook.js';
import { validateRows } from './validate-rows.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const templatePath = join(root, 'docs/templates/题库导入模板.xlsx');

async function main(): Promise<void> {
  const buffer = readFileSync(templatePath);
  const parsed = await parseWorkbook(buffer);
  const { questions, errors } = validateRows(parsed.rows);

  if (parsed.skippedExampleCount < 1) {
    console.error('FAIL: expected example rows to be skipped');
    process.exit(1);
  }

  if (errors.length > 0) {
    console.error('FAIL: template should validate:', errors);
    process.exit(1);
  }

  // Official template may contain only 【示例】 rows (D-05); zero importable rows is valid.

  const bad = validateRows([
    {
      rowNumber: 99,
      stem: '坏题',
      typeText: '单选',
      answerRaw: 'Z',
      options: new Map([['A', '一'], ['B', '二']]),
    },
  ]);
  if (bad.errors.length === 0 || bad.questions.length > 0) {
    console.error('FAIL: invalid answer should produce errors only');
    process.exit(1);
  }

  console.log(
    `OK: parsed ${questions.length} questions, skipped ${parsed.skippedExampleCount} examples`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

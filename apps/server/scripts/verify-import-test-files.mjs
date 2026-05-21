import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseWorkbook as parseRoster } from '../src/lib/roster/parse-workbook.js';
import { validateRows as validateRoster } from '../src/lib/roster/validate-rows.js';
import { parseWorkbook as parseQbank } from '../src/lib/qbank/parse-workbook.js';
import { validateRows as validateQbank } from '../src/lib/qbank/validate-rows.js';
import { prisma } from '../src/lib/prisma.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = join(repoRoot, 'docs/fixtures/import-test');

const rosterBuf = readFileSync(join(dir, '名单导入-测试.xlsx'));
const qbankBuf = readFileSync(join(dir, '题库导入-测试.xlsx'));

const rp = await parseRoster(rosterBuf);
const rv = await validateRoster(rp.rows);
console.log(
  `roster: ${rp.rows.length} rows, ${rv.entries.length} entries, ${rv.errors.length} errors`,
);
if (rv.errors.length) console.error(rv.errors);

const qp = await parseQbank(qbankBuf);
const qv = validateQbank(qp.rows);
console.log(
  `qbank: ${qp.rows.length} rows, ${qv.questions.length} questions, ${qv.errors.length} errors`,
);
if (qv.errors.length) console.error(qv.errors);

await prisma.$disconnect();

if (rv.errors.length || qv.errors.length || rv.entries.length === 0 || qv.questions.length === 0) {
  process.exit(1);
}

import { readFileSync } from 'node:fs';
import { parseWorkbook } from '../dist/lib/roster/parse-workbook.js';
import { validateRows } from '../dist/lib/roster/validate-rows.js';
import { importRoster } from '../dist/lib/roster/import-roster.js';
import { prisma } from '../dist/lib/prisma.js';

const path = process.argv[2] ?? 'C:/Users/23891/Desktop/名单导入-测试.xlsx';
const buf = readFileSync(path);
const parsed = await parseWorkbook(buf);
const validated = await validateRows(parsed.rows);
const teacher = await prisma.teacher.findFirst({ select: { id: true } });
if (!teacher) throw new Error('no teacher');
const result = await importRoster(prisma, {
  teacherId: teacher.id,
  fileName: '名单导入-测试.xlsx',
  entries: validated.entries,
  skippedCount: 0,
});
console.log('IMPORT_OK', result);
await prisma.$disconnect();

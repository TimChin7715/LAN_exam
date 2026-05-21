import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFillInImportTemplateExcel } from '../src/lib/fillin/parse-answer-sheet.js';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const outPath = path.join(root, 'docs/templates/填空题导入模板.xlsx');

const buf = await buildFillInImportTemplateExcel();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buf);
console.log('Wrote', outPath);

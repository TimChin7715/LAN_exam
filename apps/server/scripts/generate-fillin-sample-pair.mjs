/**
 * Generates paired Word + Excel for fill-in import demo.
 * Run: node apps/server/scripts/generate-fillin-sample-pair.mjs
 */
import { createRequire } from 'node:module';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const templatesDir = path.join(root, 'templates');
const wordPath = path.join(templatesDir, '操作题导入示例-题目.docx');
const excelPath = path.join(templatesDir, '操作题导入示例-答题卡.xlsx');

const require = createRequire(import.meta.url);
const JSZip = require(
  path.join(root, 'node_modules/.pnpm/jszip@3.10.1/node_modules/jszip'),
);

const paragraphs = [
  'LAN 考试系统操作题导入示例',
  '',
  '说明：题号使用「1.」「2.」等半角句点格式分段；Excel 答题卡中同一题号多行表示多空，行顺序即空位顺序。',
  '',
  '1. 我国的首都是____，该城市常用的简称之一是____。',
  '',
  '2. 中国最长的河流之一是____，其最终注入____海。',
];

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphXml(text) {
  if (!text) {
    return '<w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>';
  }
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map(paragraphXml).join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

const zip = new JSZip();
zip.file('[Content_Types].xml', contentTypesXml);
zip.folder('_rels')?.file('.rels', relsXml);
zip.folder('word')?.file('document.xml', documentXml);
zip.folder('word')?.folder('_rels')?.file('document.xml.rels', documentRelsXml);

const wordBuffer = await zip.generateAsync({ type: 'nodebuffer' });
fs.mkdirSync(templatesDir, { recursive: true });
fs.writeFileSync(wordPath, wordBuffer);

const FILLIN_ANSWER_COL = 2;
function applyAnswerTextFormat(sheet) {
  sheet.getColumn(FILLIN_ANSWER_COL).numFmt = '@';
}
function addAnswerRow(sheet, questionNo, answer, points) {
  const row = sheet.addRow([questionNo, answer, points]);
  const cell = row.getCell(FILLIN_ANSWER_COL);
  cell.numFmt = '@';
  cell.value = answer;
}

const wb = new ExcelJS.Workbook();
const sheet = wb.addWorksheet('答题卡');
sheet.addRow(['题号', '答案', '分值']);
applyAnswerTextFormat(sheet);
addAnswerRow(sheet, 1, '北京', 2);
addAnswerRow(sheet, 1, '京|首都', 2);
addAnswerRow(sheet, 2, '长江', 3);
addAnswerRow(sheet, 2, '东海|东', 2);
await wb.xlsx.writeFile(excelPath);

console.log('Wrote', wordPath);
console.log('Wrote', excelPath);

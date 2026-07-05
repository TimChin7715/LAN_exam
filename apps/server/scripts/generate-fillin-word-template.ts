import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const outPath = path.join(root, 'templates/操作题导入模板.docx');

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraph(text: string, bold = false): string {
  const runProps = bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p><w:r>${runProps}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

const lines = [
  { text: '操作题导入模板', bold: true },
  { text: '' },
  { text: '怎么填：', bold: true },
  { text: '1. 只需上传本 Word 文件即可导入。' },
  { text: '2. 每空使用【标准答案】（分值），多个可接受答案用 | 分隔。' },
  { text: '   例如：我国的首都是【北京|北平】（2分）' },
  { text: '3. 题号用 1. / 2. / 3. … 开头（半角句点）；一题多空写在同一段即可。' },
  { text: '4. 请使用 .docx 格式以保留图片；删除下方【示例】行后再导入。' },
  { text: '5. 表格单元格内同样须写【答案】（分值），且答案与分值写在同一单元格。' },
  { text: '' },
  { text: '【示例】请删除本行后，按下列格式填写真实题目：' },
  { text: '1. 中国的首都是【北京|北平】（2分），直辖市之一是【上海】（3分）' },
];

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${lines.map((line) => paragraph(line.text, line.bold)).join('\n    ')}
    <w:sectPr/>
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

const zip = new JSZip();
zip.file('[Content_Types].xml', contentTypes);
zip.folder('_rels')!.file('.rels', rels);
zip.folder('word')!.file('document.xml', documentXml);
zip.folder('word')!.folder('_rels')!.file('document.xml.rels', documentRels);

const buf = await zip.generateAsync({ type: 'nodebuffer' });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buf);
console.log('Wrote', outPath);

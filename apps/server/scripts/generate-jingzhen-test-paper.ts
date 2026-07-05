import fs from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';

import { parseWordFillDocument } from '../src/lib/fillin/parse-word-fill.js';

const outPath =
  process.argv[2] ??
  path.join(process.env.USERPROFILE ?? '', 'Desktop', '测试填空题.docx');

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

const questions = [
  '1. 公安机关经济犯罪侦查部门的简称是【经侦】（2分），主要打击危害社会主义市场经济秩序的【经济犯罪】（2分）活动。',
  '2. 根据《刑法》，合同诈骗罪规定在刑法第【224】（2分）条；非法吸收公众存款罪侵犯的客体是国家的【金融管理秩序】（3分）。',
  '3. 组织、领导传销活动罪规定在刑法第【224条之一】（3分）；《反洗钱法》规定，金融机构应当履行【反洗钱】（2分）义务。',
  '4. 洗钱罪的上游犯罪包括毒品犯罪、黑社会性质的组织犯罪、恐怖活动犯罪、走私犯罪、贪污贿赂犯罪、破坏金融管理秩序犯罪、【金融诈骗犯罪】（3分）等；经侦民警在办理涉企案件时，应当落实【少捕慎诉慎押】（3分）等司法政策。',
  '5. 对犯罪嫌疑人存款、汇款、债券、股票、基金份额等财产进行冻结，冻结期限最长为【六个月|6个月】（2分）；公安机关办理经济犯罪案件，应当坚持【证据确实充分】（3分）的证明标准。',
  '6. 虚开增值税专用发票罪规定在刑法第【205】（2分）条；职务侵占罪的主体为【非国家工作人员】（3分）。',
  '7. 对涉嫌破坏社会主义市场经济秩序犯罪案件的立案追诉，由【公安机关|公安部门】（2分）负责；经侦部门在侦查非法集资案件时，应当准确区分非法集资与【民间借贷|合法融资】（3分）等行为的界限。',
  '8. 非法吸收公众存款或者变相吸收公众存款，扰乱金融秩序，个人犯罪数额在【二十万元|20万元】（2分）以上的，应予立案追诉；办理跨境经济犯罪案件，公安机关可以依法开展【国际执法合作|国际警务合作】（3分）。',
  '9. 公安机关查询、冻结犯罪嫌疑人的存款、汇款、债券、股票、基金份额等财产，应当经【县级以上|县级以上的】（2分）公安机关负责人批准；生产、销售伪劣产品罪相关条文在刑法第【140】（2分）条。',
  '10. 经侦工作应当服务高质量发展，依法平等保护各类【市场主体|市场主体合法权益】（2分）；对查封、扣押、冻结的涉案财物，应当妥善保管，并随案移送，制作【随案移送清单|查封扣押清单】（3分）。',
];

const blankCount = questions.reduce((sum, q) => {
  const re = /【([^】\n]+)】\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)]/g;
  let n = 0;
  while (re.exec(q) !== null) n += 1;
  return sum + n;
}, 0);

const lines = [
  { text: '公安经侦业务知识测试（操作题）', bold: true },
  { text: '满分说明：共 10 题、20 空，请按【标准答案】（分值）格式作答；一题多空写在同一段。', bold: false },
  { text: '' },
  ...questions.map((text) => ({ text, bold: false })),
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

const parsed = await parseWordFillDocument(buf, path.basename(outPath));
if (parsed.errors.length > 0) {
  console.error('Parse errors:', parsed.errors);
}
if (parsed.blanks.length !== blankCount) {
  console.error(
    `Expected ${blankCount} blanks, got ${parsed.blanks.length}`,
  );
  process.exit(1);
}
console.log('Wrote', outPath, `(${parsed.blanks.length} blanks)`);

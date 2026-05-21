/**
 * Generate roster + qbank import test workbooks from official templates.
 * Usage: node scripts/generate-import-test-files.mjs [templateDir]
 */
import ExcelJS from 'exceljs';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(serverRoot, '../..');
const defaultTemplateDir = 'C:/Users/23891/Desktop';
const templateDir = process.argv[2] ?? defaultTemplateDir;

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK_CHARS = '10X98765432';

function makeNationalId(body17) {
  if (!/^\d{17}$/.test(body17)) throw new Error(`bad body: ${body17}`);
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

const rosterRows = [
  ['李明', '第一考场', makeNationalId('11010119900307803')],
  ['王芳', '第一考场', makeNationalId('11010119880515602')],
  ['张伟', '第二考场', makeNationalId('32010619951212001')],
  ['刘洋', '第二考场', makeNationalId('44010419920815301')],
  ['陈静', '第三考场', makeNationalId('33010219961108002')],
  ['赵强', '第三考场', makeNationalId('51010519940122001')],
  ['孙丽', '第四考场', makeNationalId('37010219970605001')],
  ['周杰', '第四考场', makeNationalId('42010619930901101')],
];

const qbankRows = [
  {
    题干: '局域网考试系统中，教师端主要用于完成哪类工作？',
    题型: '单选',
    A: '导入题库与名单、组织考试',
    B: '学生在线答题的唯一入口',
    C: '自动生成毕业论文',
    D: '远程控制考生电脑桌面',
    答案: 'A',
    解析: '教师端负责题库、名单与考试管理。',
    知识点: '系统功能',
    难度: 1,
    分值: 2,
    警种: '',
  },
  {
    题干: '以下哪些属于常见的传输层协议？',
    题型: '多选',
    A: 'TCP',
    B: 'UDP',
    C: 'HTTP',
    D: 'ICMP',
    E: 'FTP',
    F: '',
    答案: 'A,B',
    解析: 'HTTP/FTP 属于应用层；ICMP 属于网络层。',
    知识点: '计算机网络',
    难度: 2,
    分值: 3,
    警种: '',
  },
  {
    题干: '判断题：IPv4 地址长度为 32 位。',
    题型: '判断',
    A: '正确',
    B: '错误',
    C: '',
    D: '',
    E: '',
    F: '',
    答案: 'A',
    解析: 'IPv4 使用 32 位地址。',
    知识点: '计算机网络',
    难度: 1,
    分值: 1,
    警种: '',
  },
  {
    题干: '考生登录验证时，系统校验的是哪两项信息？',
    题型: '单选',
    A: '姓名与身份证号',
    B: '用户名与密码',
    C: '准考证号与手机号',
    D: '邮箱与验证码',
    答案: 'A',
    解析: '学生入口使用名单强绑定身份。',
    知识点: '身份认证',
    难度: 2,
    分值: 2,
    警种: '',
  },
  {
    题干: '以下哪些措施有助于保障考场内考试公平？',
    题型: '多选',
    A: '限定局域网访问',
    B: '名单与证件信息一致校验',
    C: '考试进行中禁止重复提交',
    D: '允许考生随意切换账号',
    答案: 'A,B,C',
    解析: '应防止代考与重复提交。',
    知识点: '考试管理',
    难度: 3,
    分值: 3,
    警种: '',
  },
  {
    题干: '判断题：多选题采用全对才得分策略。',
    题型: '判断',
    A: '正确',
    B: '错误',
    答案: 'A',
    解析: '本项目多选默认全对才得分。',
    知识点: '计分规则',
    难度: 2,
    分值: 1,
    警种: '',
  },
];

async function buildRoster(outPath) {
  const templatePath = join(templateDir, '名单导入模板.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(templatePath));
  const sheet = wb.getWorksheet('名单导入');
  if (!sheet) throw new Error('missing sheet 名单导入');
  const headers = headerMap(sheet);
  let rowNum = sheet.rowCount;
  for (const [name, organization, id] of rosterRows) {
    rowNum += 1;
    const row = sheet.getRow(rowNum);
    setByHeader(row, headers, '姓名', name);
    setByHeader(row, headers, '单位', organization);
    setByHeader(row, headers, '身份证号', id, { asText: true });
  }
  await wb.xlsx.writeFile(outPath);
}

async function buildQbank(outPath) {
  const templatePath = join(templateDir, '题库导入模板.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(templatePath));
  const sheet = wb.getWorksheet('题库导入');
  if (!sheet) throw new Error('missing sheet 题库导入');
  const headers = headerMap(sheet);
  const cols = [
    '题干',
    '题型',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    '答案',
    '解析',
    '知识点',
    '难度',
    '分值',
    '警种',
  ];
  let rowNum = sheet.rowCount;
  for (const data of qbankRows) {
    rowNum += 1;
    const row = sheet.getRow(rowNum);
    for (const col of cols) {
      if (headers.has(col)) {
        setByHeader(row, headers, col, data[col] ?? '');
      }
    }
  }
  await wb.xlsx.writeFile(outPath);
}

const outDir = join(repoRoot, 'docs', 'fixtures', 'import-test');
mkdirSync(outDir, { recursive: true });

const rosterOut = join(outDir, '名单导入-测试.xlsx');
const qbankOut = join(outDir, '题库导入-测试.xlsx');

await buildRoster(rosterOut);
await buildQbank(qbankOut);

const desktopRoster = join(templateDir, '名单导入-测试.xlsx');
const desktopQbank = join(templateDir, '题库导入-测试.xlsx');
copyFileSync(rosterOut, desktopRoster);
copyFileSync(qbankOut, desktopQbank);

console.log('Generated:');
console.log(' ', rosterOut);
console.log(' ', qbankOut);
console.log('Copied to Desktop:');
console.log(' ', desktopRoster);
console.log(' ', desktopQbank);

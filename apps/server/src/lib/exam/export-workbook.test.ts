import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import ExcelJS from 'exceljs';

import {
  displayFillAnswer,
  formatFillAnswerKeysPreview,
} from '../fillin/export-display.js';
import {
  buildSummaryRowQuestionFields,
  perQuestionScoresForSummary,
} from './export-summary.js';
import {
  buildSummarySheetColumns,
  FILL_IN_DETAIL_HEADERS,
  OBJECTIVE_DETAIL_HEADERS,
  type SummaryExamQuestion,
} from './export-workbook.js';

const objectiveQuestions: SummaryExamQuestion[] = [
  {
    id: 'eq1',
    sortOrder: 0,
    type: 'SINGLE',
    fillQuestionNo: null,
    fillBlankIndex: null,
  },
  {
    id: 'eq2',
    sortOrder: 1,
    type: 'SINGLE',
    fillQuestionNo: null,
    fillBlankIndex: null,
  },
];

const mixedQuestions: SummaryExamQuestion[] = [
  objectiveQuestions[0]!,
  {
    id: 'eq-fill',
    sortOrder: 1,
    type: 'FILL',
    fillQuestionNo: '3',
    fillBlankIndex: '2',
  },
];

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../..',
);
const fixturePath = join(repoRoot, 'fixtures/export/test1-成绩导出.xlsx');

function headerValues(sheet: ExcelJS.Worksheet): string[] {
  const row = sheet.getRow(1);
  const values: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    values[col - 1] = String(cell.value ?? '');
  });
  return values.filter((v) => v !== '');
}

function assertSummaryObjectiveDetailConsistency(
  workbook: ExcelJS.Workbook,
  studentName: string,
): void {
  const summary = workbook.getWorksheet('成绩汇总');
  const detail = workbook.getWorksheet('答题明细');
  assert.ok(summary);
  assert.ok(detail);

  const summaryHeaders = headerValues(summary);
  const questionCount = summaryHeaders.filter((h) =>
    /^第\d+题$/.test(h),
  ).length;

  const summaryRow = summary
    .getSheetValues()
    .slice(2)
    .find((row) => Array.isArray(row) && row[1] === studentName) as
    | ExcelJS.CellValue[]
    | undefined;
  assert.ok(summaryRow, `summary row for ${studentName}`);

  for (let k = 1; k <= questionCount; k++) {
    const header = `第${k}题`;
    const colIndex = summaryHeaders.indexOf(header);
    assert.ok(colIndex >= 0, `summary header ${header}`);
    const summaryScore: ExcelJS.CellValue = summaryRow[colIndex + 1];

    const detailRow = detail
      .getSheetValues()
      .slice(2)
      .find(
        (row) =>
          Array.isArray(row) &&
          row[1] === studentName &&
          row[4] === k,
      ) as ExcelJS.CellValue[] | undefined;
    assert.ok(detailRow, `detail row for ${studentName} 题号 ${k}`);
    assert.equal(
      summaryScore,
      detailRow[9],
      `第${k}题 summary vs detail 得分 for ${studentName}`,
    );
  }
}

function assertSummaryFillInConsistency(
  workbook: ExcelJS.Workbook,
  studentName: string,
  sortOrder: number,
  expectedHeader: string,
): void {
  const summary = workbook.getWorksheet('成绩汇总');
  const fillIn = workbook.getWorksheet('操作题明细');
  assert.ok(summary);
  assert.ok(fillIn);

  const summaryHeaders = headerValues(summary);
  const colIndex = summaryHeaders.indexOf(expectedHeader);
  assert.ok(colIndex >= 0, `summary header ${expectedHeader}`);

  const summaryRow = summary
    .getSheetValues()
    .slice(2)
    .find((row) => Array.isArray(row) && row[1] === studentName) as
    | ExcelJS.CellValue[]
    | undefined;
  assert.ok(summaryRow);
  const summaryScore = summaryRow[colIndex + 1];

  const fillRow = fillIn
    .getSheetValues()
    .slice(2)
    .find(
      (row) =>
        Array.isArray(row) && row[1] === studentName && row[4] === sortOrder,
    ) as ExcelJS.CellValue[] | undefined;
  assert.ok(fillRow, `fill-in row for ${studentName} 题序 ${sortOrder}`);
  assert.equal(summaryScore, fillRow[10], 'summary vs 操作题明细 得分');
}

describe('perQuestionScoresForSummary', () => {
  it('returns all em-dash when unsubmitted', () => {
    const scores = perQuestionScoresForSummary(objectiveQuestions, undefined);
    assert.deepEqual(scores, ['—', '—']);
  });

  it('maps pointsAwarded by examQuestion id', () => {
    const scores = perQuestionScoresForSummary(objectiveQuestions, {
      answers: [
        { examQuestion: { id: 'eq1' }, pointsAwarded: 2 },
        { examQuestion: { id: 'eq2' }, pointsAwarded: 0 },
      ],
    });
    assert.deepEqual(scores, [2, 0]);
  });

  it('uses 0 when submitted but answer row missing for a question', () => {
    const scores = perQuestionScoresForSummary(objectiveQuestions, {
      answers: [{ examQuestion: { id: 'eq1' }, pointsAwarded: 2 }],
    });
    assert.deepEqual(scores, [2, 0]);
  });

  it('preserves explicit zero score', () => {
    const scores = perQuestionScoresForSummary(objectiveQuestions, {
      answers: [
        { examQuestion: { id: 'eq1' }, pointsAwarded: 0 },
        { examQuestion: { id: 'eq2' }, pointsAwarded: 1.5 },
      ],
    });
    assert.deepEqual(scores, [0, 1.5]);
  });
});

describe('buildSummaryRowQuestionFields', () => {
  it('uses stable q_${id} keys', () => {
    const fields = buildSummaryRowQuestionFields(objectiveQuestions, {
      answers: [
        { examQuestion: { id: 'eq1' }, pointsAwarded: 1 },
        { examQuestion: { id: 'eq2' }, pointsAwarded: 2 },
      ],
    });
    assert.deepEqual(fields, { q_eq1: 1, q_eq2: 2 });
  });
});

describe('buildSummarySheetColumns', () => {
  it('appends 第1题…第N题 after fixed six columns', () => {
    const cols = buildSummarySheetColumns(objectiveQuestions);
    assert.equal(cols.length, 8);
    assert.equal(cols[0]!.header, '姓名');
    assert.equal(cols[1]!.header, '单位');
    assert.equal(cols[6]!.header, '第1题');
    assert.equal(cols[6]!.key, 'q_eq1');
    assert.equal(cols[7]!.header, '第2题');
    assert.equal(cols[7]!.key, 'q_eq2');
  });

  it('annotates FILL columns with 答题卡题号 and 空位', () => {
    const cols = buildSummarySheetColumns(mixedQuestions);
    assert.equal(cols[7]!.header, '第2题(题号3-2)');
    assert.equal(cols[7]!.key, 'q_eq-fill');
  });
});

describe('fillin export-display', () => {
  it('formats pipe-separated answer keys', () => {
    assert.equal(formatFillAnswerKeysPreview('foo|bar'), 'foo / bar');
  });

  it('formats JSON student answer', () => {
    assert.equal(
      displayFillAnswer('{"1":"甲","2":"乙"}'),
      '甲；乙',
    );
  });
});

describe('summary workbook round-trip', () => {
  it('writes headers and unsubmitted question cells as em-dash', async () => {
    const wb = new ExcelJS.Workbook();
    const summary = wb.addWorksheet('成绩汇总');
    summary.columns = buildSummarySheetColumns(objectiveQuestions);
    summary.getRow(1).font = { bold: true };

    summary.addRow({
      name: '张三',
      id: '110101********1234',
      score: '—',
      submitted: '未提交',
      time: '',
      ...buildSummaryRowQuestionFields(objectiveQuestions, undefined),
    });

    summary.addRow({
      name: '李四',
      id: '110101********5678',
      score: 3,
      submitted: '已提交',
      time: '2026-05-17 10:00',
      ...buildSummaryRowQuestionFields(objectiveQuestions, {
        answers: [
          { examQuestion: { id: 'eq1' }, pointsAwarded: 2 },
          { examQuestion: { id: 'eq2' }, pointsAwarded: 1 },
        ],
      }),
    });

    const detail = wb.addWorksheet('答题明细');
    detail.columns = OBJECTIVE_DETAIL_HEADERS.map((header, i) => ({
      header,
      key: [
        'name',
        'organization',
        'id',
        'num',
        'type',
        'selected',
        'correct',
        'right',
        'points',
      ][i]!,
      width: 10,
    }));
    detail.addRow({
      name: '李四',
      organization: '示例单位',
      id: '110101********5678',
      num: 1,
      type: '单选',
      selected: 'A',
      correct: 'A',
      right: '是',
      points: 2,
    });
    detail.addRow({
      name: '李四',
      organization: '示例单位',
      id: '110101********5678',
      num: 2,
      type: '单选',
      selected: 'B',
      correct: 'A',
      right: '否',
      points: 1,
    });

    const buffer = await wb.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const loadedSummary = loaded.getWorksheet('成绩汇总')!;
    assert.equal(loadedSummary.getRow(1).getCell(7).value, '第1题');
    assert.equal(loadedSummary.getRow(2).getCell(7).value, '—');
    assert.equal(loadedSummary.getRow(2).getCell(8).value, '—');
    assert.equal(loadedSummary.getRow(3).getCell(7).value, 2);
    assert.equal(loadedSummary.getRow(3).getCell(8).value, 1);

    assertSummaryObjectiveDetailConsistency(loaded, '李四');
  });

  it('splits objective and fill-in across detail sheets', async () => {
    const wb = new ExcelJS.Workbook();
    const summary = wb.addWorksheet('成绩汇总');
    summary.columns = buildSummarySheetColumns(mixedQuestions);
    summary.getRow(1).font = { bold: true };
    summary.addRow({
      name: '王五',
      organization: '单位A',
      id: '110101********9999',
      score: 5,
      submitted: '已提交',
      time: '2026-05-20 09:00',
      q_eq1: 2,
      'q_eq-fill': 3,
    });

    const detail = wb.addWorksheet('答题明细');
    detail.columns = OBJECTIVE_DETAIL_HEADERS.map((header, i) => ({
      header,
      key: [
        'name',
        'organization',
        'id',
        'num',
        'type',
        'selected',
        'correct',
        'right',
        'points',
      ][i]!,
      width: 10,
    }));
    detail.addRow({
      name: '王五',
      num: 1,
      type: '单选',
      selected: 'A',
      correct: 'A',
      right: '是',
      points: 2,
    });

    const fillIn = wb.addWorksheet('操作题明细');
    fillIn.columns = FILL_IN_DETAIL_HEADERS.map((header, i) => ({
      header,
      key: [
        'name',
        'organization',
        'id',
        'num',
        'fillNo',
        'blank',
        'selected',
        'correct',
        'right',
        'points',
        'maxPoints',
      ][i]!,
      width: 10,
    }));
    fillIn.addRow({
      name: '王五',
      organization: '单位A',
      id: '110101********9999',
      num: 2,
      fillNo: '3',
      blank: '2',
      selected: '答案甲',
      correct: '答案甲 / 别名',
      right: '是',
      points: 3,
      maxPoints: 3,
    });

    const buffer = await wb.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const objectiveDetail = loaded.getWorksheet('答题明细')!;
    const fillDetail = loaded.getWorksheet('操作题明细')!;
    assert.deepEqual(headerValues(objectiveDetail), [...OBJECTIVE_DETAIL_HEADERS]);
    assert.deepEqual(headerValues(fillDetail), [...FILL_IN_DETAIL_HEADERS]);

    const objectiveRows = objectiveDetail.getSheetValues().slice(2);
    assert.equal(objectiveRows.length, 1);
    assert.notEqual(objectiveRows[0]?.[5], '操作');

    const fillRows = fillDetail.getSheetValues().slice(2);
    assert.equal(fillRows.length, 1);
    assert.equal(fillRows[0]?.[5], '3');
    assert.equal(fillRows[0]?.[6], '2');

    assertSummaryObjectiveDetailConsistency(loaded, '王五');
    assertSummaryFillInConsistency(
      loaded,
      '王五',
      2,
      '第2题(题号3-2)',
    );
  });
});

describe('答题明细 regression', () => {
  it('keeps exactly 9 column headers', () => {
    const wb = new ExcelJS.Workbook();
    const detail = wb.addWorksheet('答题明细');
    detail.columns = OBJECTIVE_DETAIL_HEADERS.map((header, i) => ({
      header,
      key: [
        'name',
        'organization',
        'id',
        'num',
        'type',
        'selected',
        'correct',
        'right',
        'points',
      ][i]!,
      width: 10,
    }));
    assert.deepEqual(headerValues(detail), [...OBJECTIVE_DETAIL_HEADERS]);
  });
});

describe('fixture smoke (D-07)', () => {
  it('loads school sample 成绩汇总 headers when fixture exists', async () => {
    if (!existsSync(fixturePath)) {
      assert.fail(
        `fixture missing at ${fixturePath} — run scripts/generate-export-fixture.ts`,
      );
    }
    const buffer = readFileSync(fixturePath);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet('成绩汇总');
    assert.ok(sheet, '成绩汇总 worksheet');
    const fillIn = wb.getWorksheet('操作题明细');
    assert.ok(fillIn, '操作题明细 worksheet');
    const headers = headerValues(sheet);
    assert.ok(headers.includes('姓名'));
    assert.ok(headers.includes('单位'));
    assert.ok(headers.includes('第1题'));
    assert.ok(headers.includes('身份证号'));
    assert.ok(headers.includes('总分'));
    assert.ok(headers.includes('是否提交'));
    assert.ok(headers.includes('提交时间'));
    for (const row of sheet.getSheetValues().slice(2)) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        const s = String(cell ?? '');
        if (/^\d{18}$/.test(s)) {
          assert.fail(`fixture contains full 18-digit national ID: ${s}`);
        }
      }
    }
  });
});

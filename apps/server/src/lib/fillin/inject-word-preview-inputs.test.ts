import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { injectWordPreviewInputs } from './inject-word-preview-inputs.js';
import type { ParsedFillInBlank } from './types.js';

const sampleBlanks: ParsedFillInBlank[] = [
  {
    rowNumber: 1,
    questionNo: 1,
    blankIndex: 1,
    stem: '首都是【北京】（2分）',
    answerKeys: '北京',
    points: 2,
  },
];

const tableBlanks: ParsedFillInBlank[] = [
  {
    rowNumber: 1,
    questionNo: 10,
    blankIndex: 1,
    stem: '【111】（2分）',
    answerKeys: '111',
    points: 2,
  },
  {
    rowNumber: 2,
    questionNo: 10,
    blankIndex: 2,
    stem: '【222】（3分）',
    answerKeys: '222',
    points: 3,
  },
];

describe('injectWordPreviewInputs', () => {
  it('replaces 【答案】 with input and keeps （x分）', () => {
    const html = '<p>我国的首都是【北京】（2分）。</p>';
    const out = injectWordPreviewInputs(html, sampleBlanks);
    assert.match(out, /fillin-inline-input/);
    assert.match(out, /（2分）/);
    assert.doesNotMatch(out, /【北京】/);
  });

  it('replaces empty 【】 with input and keeps （x分）', () => {
    const html = '<p>我国的首都是【】（2分）。</p>';
    const out = injectWordPreviewInputs(html, sampleBlanks);
    assert.match(out, /fillin-inline-input/);
    assert.match(out, /（2分）/);
    assert.doesNotMatch(out, /【】/);
  });

  it('injects blanks inside table cells', () => {
    const html =
      '<table><tr><td><p>【111】（2分）</p></td><td>【222】（3分）</td></tr></table>';
    const out = injectWordPreviewInputs(html, tableBlanks);
    assert.equal((out.match(/fillin-inline-input/g) ?? []).length, 2);
    assert.doesNotMatch(out, /【111】/);
    assert.doesNotMatch(out, /【222】/);
  });

  it('injects when answer and points are split across tags in a cell', () => {
    const html =
      '<table><tr><td><p>【111】</p><p>（2分）</p></td><td><p>【222】（3分）</p></td></tr></table>';
    const out = injectWordPreviewInputs(html, tableBlanks);
    assert.equal((out.match(/fillin-inline-input/g) ?? []).length, 2);
    assert.doesNotMatch(out, /【111】/);
  });

  it('binds table blanks in document order when table is after body text', () => {
    const bodyBlanks: ParsedFillInBlank[] = [
      {
        rowNumber: 1,
        questionNo: 1,
        blankIndex: 1,
        stem: '【a】（1分）',
        answerKeys: 'a',
        points: 1,
      },
      {
        rowNumber: 2,
        questionNo: 1,
        blankIndex: 2,
        stem: '【b】（1分）',
        answerKeys: 'b',
        points: 1,
      },
      {
        rowNumber: 3,
        questionNo: 9,
        blankIndex: 3,
        stem: '【111】（1分）',
        answerKeys: '111',
        points: 1,
      },
      {
        rowNumber: 4,
        questionNo: 9,
        blankIndex: 4,
        stem: '【222】（1分）',
        answerKeys: '222',
        points: 1,
      },
    ];
    const html =
      '<p>第一空【a】（1分）第二空【b】（1分）</p>' +
      '<table><tr><td>【111】（1分）</td><td>【222】（1分）</td></tr></table>';
    const out = injectWordPreviewInputs(html, bodyBlanks);
    assert.equal((out.match(/fillin-inline-input/g) ?? []).length, 4);
    assert.match(out, /data-fillin-question-no="9" data-fillin-blank-index="3"/);
    assert.match(out, /data-fillin-question-no="9" data-fillin-blank-index="4"/);
    assert.doesNotMatch(out, /【111】/);
    assert.doesNotMatch(out, /【222】/);
  });
});

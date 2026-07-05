import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countWordBlankMarkersInHtml,
  parseWordFillText,
  previewHtmlLeaksFilledAnswers,
  splitAcceptedAnswers,
} from './parse-word-fill.js';
import { injectWordPreviewInputs } from './inject-word-preview-inputs.js';

describe('parseWordFillText', () => {
  it('parses single blank with score', () => {
    const { blanks, errors } = parseWordFillText(
      '我国的首都是【北京|北平】（2分）。',
    );
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 1);
    assert.equal(blanks[0]!.answerKeys, '北京|北平');
    assert.equal(blanks[0]!.points, 2);
    assert.equal(blanks[0]!.questionNo, 1);
    assert.equal(blanks[0]!.blankIndex, 1);
  });

  it('parses multiple blanks in numbered question', () => {
    const text =
      '1. 我国的首都是【北京】（2分），最大直辖市是【上海】（3分）';
    const { blanks, errors } = parseWordFillText(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 2);
    assert.equal(blanks[0]!.questionNo, 1);
    assert.equal(blanks[0]!.blankIndex, 1);
    assert.equal(blanks[1]!.blankIndex, 2);
    assert.equal(blanks[0]!.points, 2);
    assert.equal(blanks[1]!.points, 3);
  });

  it('parses multiple questions', () => {
    const text = [
      '1. 首都是【北京】（2分）',
      '2. 朝代是【唐|唐朝】（1分）',
    ].join('\n');
    const { blanks, errors } = parseWordFillText(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 2);
    assert.equal(blanks[0]!.questionNo, 1);
    assert.equal(blanks[1]!.questionNo, 2);
  });

  it('accepts halfwidth parentheses for points', () => {
    const { blanks, errors } = parseWordFillText('编号【00123】(2.5分)');
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks[0]!.points, 2.5);
  });

  it('rejects empty answer brackets', () => {
    const { blanks, errors } = parseWordFillText('题目【】（2分）');
    assert.equal(blanks.length, 0);
    assert.ok(errors.length > 0);
  });

  it('rejects unsupported blank markers', () => {
    const { errors } = parseWordFillText('1. 首都是____（2分）');
    assert.ok(errors.some((e) => e.message.includes('____')));
  });

  it('skips 【示例】 question segments', () => {
    const text = '【示例】中国的首都是【北京】（2分）\n1. 真实题【上海】（1分）';
    const { blanks, errors } = parseWordFillText(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 1);
    assert.equal(blanks[0]!.answerKeys, '上海');
  });

  it('parses first question when Word list drops the number prefix', () => {
    const text = [
      '公安经侦业务知识测试（操作题）',
      '',
      '满分说明：共 10 题、20 空。',
      '',
      '公安机关经济犯罪侦查部门的简称是【经侦】（2分），主要打击【经济犯罪】（2分）活动。',
      '2. 第二题【224】（2分）',
    ].join('\n');
    const { blanks, errors } = parseWordFillText(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 3);
    assert.equal(blanks[0]!.questionNo, 1);
    assert.equal(blanks[0]!.answerKeys, '经侦');
    assert.equal(blanks[2]!.questionNo, 2);
  });

  it('parses blanks inside table plain text after last question', () => {
    const text = [
      '10. 最后一题【表内】（1分）',
      '问题1\t问题2',
      '【111】（2分）\t【222】（3分）',
    ].join('\n');
    const { blanks, errors } = parseWordFillText(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 3);
    assert.equal(blanks[1]!.answerKeys, '111');
    assert.equal(blanks[2]!.answerKeys, '222');
  });

  it('reports bare brackets without points', () => {
    const { blanks, errors } = parseWordFillText('1. 表格【111】【222】');
    assert.equal(blanks.length, 0);
    assert.ok(errors.some((error) => error.message.includes('【111】')));
    assert.ok(errors.some((error) => error.message.includes('缺少（分值）')));
  });

  it('does not confuse distant punctuation when splitting question bodies', () => {
    const text = [
      '1.收款凭证和付款凭证不仅是记账的依据。【A】（1分）',
      '2.根据案件侦办需要，可以对金融机构存款准备金进行冻结。【A】（1分）',
    ].join('\n');
    const { blanks, errors } = parseWordFillText(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 2);
    assert.equal(blanks[0]!.questionNo, 1);
    assert.equal(blanks[1]!.questionNo, 2);
  });

  it('does not treat 2、 as a new question (dot-only numbering)', () => {
    const text = [
      '1. 首都是【北京】（2分）',
      '2、朝代是【唐|唐朝】（1分）',
    ].join('\n');
    const { blanks, errors } = parseWordFillText(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 2);
    assert.equal(blanks[0]!.questionNo, 1);
    assert.equal(blanks[1]!.questionNo, 1);
    assert.equal(blanks[0]!.blankIndex, 1);
    assert.equal(blanks[1]!.blankIndex, 2);
  });

  it('splits A111-like layout: subsection header stays with previous question until N.', () => {
    const text = [
      '1.该数据是哪个金融机构反馈的数据？【蚂蚁金服公司】（2分）',
      '',
      '（二）请根据"李一玲"2024年8月的相关资金数据，回答以下问题：',
      '2.判断在哪些市活动过？【广州|南京】（8分）',
    ].join('\n');
    const { blanks, errors } = parseWordFillText(text);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(blanks.length, 2);
    assert.equal(blanks[0]!.questionNo, 1);
    assert.equal(blanks[1]!.questionNo, 2);
    assert.ok(blanks[0]!.stem.includes('（二）'));
  });
});

describe('splitAcceptedAnswers', () => {
  it('splits pipe-separated answers', () => {
    assert.deepEqual(splitAcceptedAnswers('唐|唐朝'), ['唐', '唐朝']);
    assert.deepEqual(splitAcceptedAnswers('2020-10-17|2020/10/17'), [
      '2020-10-17',
      '2020/10/17',
    ]);
  });
});

describe('countWordBlankMarkersInHtml', () => {
  it('counts blanks in HTML text nodes only', () => {
    const html =
      '<p>首都是【北京】（2分），直辖市【上海】（3分）</p>';
    assert.equal(countWordBlankMarkersInHtml(html), 2);
  });

  it('counts blanks split across tags inside table cells', () => {
    const html =
      '<table><tr><td><p>【111】</p><p>（2分）</p></td><td>【222】（3分）</td></tr></table>';
    assert.equal(countWordBlankMarkersInHtml(html), 2);
  });
});

describe('previewHtmlLeaksFilledAnswers', () => {
  it('detects unreplaced answer markers', () => {
    const html = '<p>答案【北京】（2分）</p>';
    assert.equal(previewHtmlLeaksFilledAnswers(html), true);
  });

  it('passes when blanks are replaced with inputs', () => {
    const { blanks } = parseWordFillText('首都是【北京】（2分）');
    const html = injectWordPreviewInputs(
      '<p>首都是【北京】（2分）</p>',
      blanks,
    );
    assert.equal(previewHtmlLeaksFilledAnswers(html), false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateRows } from './validate-rows.js';

function minimalObjectiveRow(
  overrides: Partial<{
    pointsRaw: string;
    stem: string;
  }> = {},
) {
  return {
    rowNumber: 2,
    stem: overrides.stem ?? '测试题干',
    typeText: '单选',
    answerRaw: 'A',
    pointsRaw: overrides.pointsRaw ?? '1',
    options: new Map([
      ['A', '选项A'],
      ['B', '选项B'],
    ]),
  };
}

describe('validateRows points', () => {
  it('accepts decimal points', () => {
    const { questions, errors } = validateRows([
      minimalObjectiveRow({ pointsRaw: '2.5' }),
      minimalObjectiveRow({ pointsRaw: '3.5', stem: '第二题' }),
    ]);
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(questions.length, 2);
    assert.equal(questions[0]!.points, 2.5);
    assert.equal(questions[1]!.points, 3.5);
  });

  it('rejects zero points', () => {
    const { questions, errors } = validateRows([
      minimalObjectiveRow({ pointsRaw: '0' }),
    ]);
    assert.equal(questions.length, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0]!.message, /大于 0/);
  });
});

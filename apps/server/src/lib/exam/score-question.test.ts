import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scoreQuestion, type ScoreableQuestion } from './score-question.js';

const multiBase: ScoreableQuestion = {
  type: 'MULTI',
  answerKeys: 'A,B,C',
  points: 5,
  multiScoringRule: 'ALL_OR_NOTHING',
  optionKeys: ['A', 'B', 'C', 'D'],
};

describe('scoreQuestion MULTI ALL_OR_NOTHING', () => {
  it('awards full points when selected set matches answerKeys exactly', () => {
    const result = scoreQuestion(multiBase, 'A,B,C');
    assert.equal(result.isCorrect, true);
    assert.equal(result.pointsAwarded, 5);
    assert.equal(result.selectedKeys, 'A,B,C');
  });

  it('awards zero when a required option is missing', () => {
    const result = scoreQuestion(multiBase, 'A,C');
    assert.equal(result.isCorrect, false);
    assert.equal(result.pointsAwarded, 0);
  });

  it('awards zero when an extra wrong option is selected', () => {
    const result = scoreQuestion(multiBase, 'A,B,C,D');
    assert.equal(result.isCorrect, false);
    assert.equal(result.pointsAwarded, 0);
  });
});

describe('scoreQuestion SINGLE', () => {
  it('awards full points when selected matches answer', () => {
    const result = scoreQuestion(
      {
        type: 'SINGLE',
        answerKeys: 'A',
        points: 2,
        multiScoringRule: null,
        optionKeys: ['A', 'B', 'C'],
      },
      'A',
    );
    assert.equal(result.isCorrect, true);
    assert.equal(result.pointsAwarded, 2);
  });

  it('awards zero when selected option is wrong', () => {
    const result = scoreQuestion(
      {
        type: 'SINGLE',
        answerKeys: 'A',
        points: 2,
        multiScoringRule: null,
        optionKeys: ['A', 'B', 'C'],
      },
      'B',
    );
    assert.equal(result.isCorrect, false);
    assert.equal(result.pointsAwarded, 0);
  });
});

describe('scoreQuestion JUDGE', () => {
  it('accepts 正确 as equivalent to answer A', () => {
    const result = scoreQuestion(
      {
        type: 'JUDGE',
        answerKeys: 'A',
        points: 1,
        multiScoringRule: null,
        optionKeys: ['A', 'B'],
      },
      '正确',
    );
    assert.equal(result.isCorrect, true);
    assert.equal(result.pointsAwarded, 1);
  });

  it('rejects 错误 when answer is A', () => {
    const result = scoreQuestion(
      {
        type: 'JUDGE',
        answerKeys: 'A',
        points: 1,
        multiScoringRule: null,
        optionKeys: ['A', 'B'],
      },
      '错误',
    );
    assert.equal(result.isCorrect, false);
    assert.equal(result.pointsAwarded, 0);
  });
});

describe('scoreQuestion empty selection', () => {
  it('returns zero points for blank selection', () => {
    const result = scoreQuestion(multiBase, '   ');
    assert.equal(result.isCorrect, false);
    assert.equal(result.pointsAwarded, 0);
    assert.equal(result.selectedKeys, '');
  });
});

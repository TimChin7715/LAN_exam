import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scoreQuestion, type ScoreableQuestion } from './score-question.js';

describe('scoreQuestion FILL (答题卡答案)', () => {
  it('matches answerKeys imported from 答题卡 答案 column', () => {
    const q: ScoreableQuestion = {
      type: 'FILL',
      answerKeys: '2020-10-17|2020/10/17',
      points: 5,
      multiScoringRule: null,
      optionKeys: [],
    };
    const r = scoreQuestion(q, '2020-10-17');
    assert.equal(r.isCorrect, true);
    assert.equal(r.pointsAwarded, 5);
    assert.equal(r.selectedKeys, '2020-10-17');
  });
});

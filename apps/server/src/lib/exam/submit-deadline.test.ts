import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scoreQuestionsFromDrafts } from './submit.js';
import type { ScoreableExamQuestion } from './exam-paper-cache.js';
import { SubmitExamError } from './types.js';

const scoreable: ScoreableExamQuestion[] = [
  {
    examQuestionId: 'eq1',
    type: 'SINGLE',
    answerKeys: 'A',
    points: 2,
    multiScoringRule: null,
    optionKeys: ['A', 'B'],
  },
  {
    examQuestionId: 'eq2',
    type: 'FILL',
    answerKeys: '答案',
    points: 3,
    multiScoringRule: null,
    optionKeys: [],
  },
];

describe('scoreQuestionsFromDrafts', () => {
  it('strict mode rejects incomplete answers', () => {
    const drafts = new Map<string, string>([['eq1', 'A']]);
    assert.throws(
      () =>
        scoreQuestionsFromDrafts(scoreable, drafts, { requireComplete: true }),
      (err) =>
        err instanceof SubmitExamError && err.code === 'INCOMPLETE_ANSWERS',
    );
  });

  it('deadline mode scores partial answers and zeros for blanks', () => {
    const drafts = new Map<string, string>([['eq1', 'A']]);
    const { totalScore, answerCreates } = scoreQuestionsFromDrafts(
      scoreable,
      drafts,
      { requireComplete: false },
    );
    assert.equal(totalScore, 2);
    assert.equal(answerCreates.length, 2);
    const blank = answerCreates.find((a) => a.examQuestionId === 'eq2');
    assert.ok(blank);
    assert.equal(blank.pointsAwarded, 0);
    assert.equal(blank.isCorrect, false);
  });
});

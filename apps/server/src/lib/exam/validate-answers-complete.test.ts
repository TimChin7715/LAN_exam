import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertAnswersComplete,
  isAnswerComplete,
  listUnansweredExamQuestionIds,
} from './validate-answers-complete.js';
import { SubmitExamError } from './types.js';

const eq = (id: string, type: 'SINGLE' | 'MULTI' | 'JUDGE' | 'FILL') => ({
  id,
  question: { type },
});

describe('isAnswerComplete', () => {
  it('requires non-empty text for SINGLE, JUDGE, and FILL', () => {
    assert.equal(isAnswerComplete('SINGLE', 'A'), true);
    assert.equal(isAnswerComplete('SINGLE', '  '), false);
    assert.equal(isAnswerComplete('JUDGE', 'T'), true);
    assert.equal(isAnswerComplete('FILL', '答案'), true);
    assert.equal(isAnswerComplete('FILL', ''), false);
  });

  it('requires at least one option for MULTI', () => {
    assert.equal(isAnswerComplete('MULTI', 'A,B'), true);
    assert.equal(isAnswerComplete('MULTI', ''), false);
    assert.equal(isAnswerComplete('MULTI', '  ,  '), false);
  });
});

describe('listUnansweredExamQuestionIds', () => {
  it('returns ids with missing or blank answers', () => {
    const questions = [eq('q1', 'SINGLE'), eq('q2', 'FILL'), eq('q3', 'MULTI')];
    const drafts = new Map<string, string>([
      ['q1', 'A'],
      ['q2', ''],
      ['q3', 'B'],
    ]);
    assert.deepEqual(listUnansweredExamQuestionIds(questions, drafts), ['q2']);
  });

  it('returns empty when all answered', () => {
    const questions = [eq('q1', 'SINGLE'), eq('q2', 'FILL')];
    const drafts = new Map<string, string>([
      ['q1', 'B'],
      ['q2', 'text'],
    ]);
    assert.deepEqual(listUnansweredExamQuestionIds(questions, drafts), []);
  });
});

describe('assertAnswersComplete', () => {
  it('throws INCOMPLETE_ANSWERS when any question is unanswered', () => {
    const questions = [eq('q1', 'SINGLE')];
    const drafts = new Map<string, string>();
    assert.throws(
      () => assertAnswersComplete(questions, drafts),
      (err: unknown) => {
        assert.ok(err instanceof SubmitExamError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INCOMPLETE_ANSWERS');
        return true;
      },
    );
  });

  it('does not throw when all questions are answered', () => {
    const questions = [eq('q1', 'MULTI'), eq('q2', 'FILL')];
    const drafts = new Map<string, string>([
      ['q1', 'A,C'],
      ['q2', 'ok'],
    ]);
    assert.doesNotThrow(() => assertAnswersComplete(questions, drafts));
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeAnswerDrafts } from './persist-answer-drafts.js';

describe('normalizeAnswerDrafts', () => {
  it('deduplicates by examQuestionId keeping last selectedKeys', () => {
    const result = normalizeAnswerDrafts([
      { examQuestionId: 'q1', selectedKeys: 'A' },
      { examQuestionId: 'q2', selectedKeys: 'B' },
      { examQuestionId: 'q1', selectedKeys: 'C' },
    ]);

    assert.deepEqual(result, [
      { examQuestionId: 'q1', selectedKeys: 'C' },
      { examQuestionId: 'q2', selectedKeys: 'B' },
    ]);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clearExamPaperCache,
  getCachedExamPaperStatic,
  getCachedScoreableQuestions,
  invalidateExamPaperCache,
  isExamPaperCached,
  setExamPaperCache,
} from './exam-paper-cache.js';

describe('exam-paper-cache', () => {
  it('stores and returns static payload and scoreable questions', () => {
    clearExamPaperCache();
    const examId = 'exam-test-1';
    assert.equal(isExamPaperCached(examId), false);

    setExamPaperCache(examId, {
      staticPayload: {
        examId,
        contentModules: ['OBJECTIVE'],
        items: [],
        fillIn: null,
        practicalMeta: null,
      },
      scoreableQuestions: [],
    });

    assert.equal(isExamPaperCached(examId), true);
    assert.equal(getCachedExamPaperStatic(examId)?.examId, examId);
    assert.deepEqual(getCachedScoreableQuestions(examId), []);
  });

  it('invalidates a single exam', () => {
    clearExamPaperCache();
    const examId = 'exam-test-2';
    setExamPaperCache(examId, {
      staticPayload: {
        examId,
        contentModules: ['OBJECTIVE'],
        items: [],
        fillIn: null,
        practicalMeta: null,
      },
      scoreableQuestions: [],
    });

    invalidateExamPaperCache(examId);
    assert.equal(isExamPaperCached(examId), false);
    assert.equal(getCachedExamPaperStatic(examId), null);
  });

  it('clearExamPaperCache removes all entries', () => {
    setExamPaperCache('a', {
      staticPayload: {
        examId: 'a',
        contentModules: ['OBJECTIVE'],
        items: [],
        fillIn: null,
        practicalMeta: null,
      },
      scoreableQuestions: [],
    });
    clearExamPaperCache();
    assert.equal(isExamPaperCached('a'), false);
  });
});

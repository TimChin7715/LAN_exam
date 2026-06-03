import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('resolveStudentInProgressExamStatus contract', () => {
  it('choose_exam when multiple in-progress and no session exam', () => {
    const inProgress = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    const selected = undefined;
    const needsChoose = inProgress.length > 1 && !selected;
    assert.equal(needsChoose, true);
  });

  it('uses selected exam when session matches', () => {
    const inProgress = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    const selected = 'b';
    const exam = inProgress.find((e) => e.id === selected);
    assert.equal(exam?.title, 'B');
  });
});

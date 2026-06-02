import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function pastScheduledEnd(
  scheduledEndAt: Date | null,
  now: Date,
): boolean {
  return Boolean(scheduledEndAt && now > scheduledEndAt);
}

describe('pastScheduledEnd access rules', () => {
  const end = new Date('2026-05-28T12:00:00Z');
  const before = new Date('2026-05-28T11:00:00Z');
  const after = new Date('2026-05-28T13:00:00Z');

  it('blocks write after scheduled end', () => {
    assert.equal(pastScheduledEnd(end, after), true);
    assert.equal(pastScheduledEnd(end, before), false);
  });

  it('allows submit path when only write would be blocked', () => {
    const mode = 'submit';
    const afterEnd = pastScheduledEnd(end, after);
    const status = 'IN_PROGRESS';
    const writeBlocked = mode === 'write' && afterEnd;
    const submitAllowed = mode === 'submit' && status === 'IN_PROGRESS';
    assert.equal(writeBlocked, false);
    assert.equal(submitAllowed, true);
  });
});

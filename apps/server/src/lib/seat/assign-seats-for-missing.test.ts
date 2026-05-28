import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { maxSeatLabelNumeric, nextSeatLabels } from './assign-seats-for-missing.js';

describe('maxSeatLabelNumeric', () => {
  it('returns max numeric seat label', () => {
    assert.equal(maxSeatLabelNumeric(['1', '3', '2']), 3);
    assert.equal(maxSeatLabelNumeric([]), 0);
    assert.equal(maxSeatLabelNumeric(['x', '5']), 5);
  });
});

describe('nextSeatLabels', () => {
  it('appends labels after current max', () => {
    assert.deepEqual(nextSeatLabels(['1', '3', '2'], 2), ['4', '5']);
    assert.deepEqual(nextSeatLabels([], 3), ['1', '2', '3']);
  });
});

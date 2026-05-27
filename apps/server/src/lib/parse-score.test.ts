import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseNonNegativeScore, parsePositiveScore } from './parse-score.js';

describe('parsePositiveScore', () => {
  it('accepts decimals', () => {
    assert.equal(parsePositiveScore('2.5'), 2.5);
    assert.equal(parsePositiveScore('3.5'), 3.5);
    assert.equal(parsePositiveScore('0.5'), 0.5);
  });

  it('defaults empty to 1', () => {
    assert.equal(parsePositiveScore(undefined), 1);
    assert.equal(parsePositiveScore(''), 1);
    assert.equal(parsePositiveScore('   '), 1);
  });

  it('rejects zero and non-numeric', () => {
    assert.equal(parsePositiveScore('0'), null);
    assert.equal(parsePositiveScore('abc'), null);
    assert.equal(parsePositiveScore('Infinity'), null);
  });

  it('rejects out of range', () => {
    assert.equal(parsePositiveScore('1001'), null);
    assert.equal(parsePositiveScore('-1'), null);
  });
});

describe('parseNonNegativeScore', () => {
  it('accepts zero and decimals', () => {
    assert.equal(parseNonNegativeScore('0'), 0);
    assert.equal(parseNonNegativeScore('2.5'), 2.5);
  });

  it('rejects empty and invalid', () => {
    assert.equal(parseNonNegativeScore(''), null);
    assert.equal(parseNonNegativeScore(undefined), null);
    assert.equal(parseNonNegativeScore('x'), null);
    assert.equal(parseNonNegativeScore('-0.1'), null);
  });
});

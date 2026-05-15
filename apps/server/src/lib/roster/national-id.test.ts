import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidNationalIdFormat } from './national-id.js';

describe('isValidNationalIdFormat', () => {
  it('accepts a valid 18-digit ID with correct checksum', () => {
    assert.equal(isValidNationalIdFormat('11010519491231002X'), true);
  });

  it('rejects wrong checksum digit', () => {
    assert.equal(isValidNationalIdFormat('110105194912310021'), false);
  });

  it('rejects wrong length', () => {
    assert.equal(isValidNationalIdFormat('110105194912310'), false);
  });
});

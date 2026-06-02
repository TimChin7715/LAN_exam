import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidNationalIdFormat, validateRosterNationalId } from './national-id.js';
import { MAX_NATIONAL_ID_LENGTH } from './types.js';

describe('validateRosterNationalId', () => {
  it('accepts short non-standard ids', () => {
    assert.equal(validateRosterNationalId('123456'), null);
    assert.equal(validateRosterNationalId('E12345678'), null);
  });

  it('accepts valid 18-digit id', () => {
    assert.equal(validateRosterNationalId('11010519491231002X'), null);
  });

  it('rejects empty', () => {
    assert.equal(validateRosterNationalId(''), '身份证号不能为空');
    assert.equal(validateRosterNationalId('   '), '身份证号不能为空');
  });

  it('rejects over max length', () => {
    const tooLong = 'a'.repeat(MAX_NATIONAL_ID_LENGTH + 1);
    assert.equal(
      validateRosterNationalId(tooLong),
      `身份证号不得超过 ${MAX_NATIONAL_ID_LENGTH} 个字符`,
    );
  });
});

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

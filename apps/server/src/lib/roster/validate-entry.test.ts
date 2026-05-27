import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateRosterEntryFields } from './validate-entry.js';

const VALID_ID = '11010519491231002X';

describe('validateRosterEntryFields', () => {
  it('accepts valid fields', () => {
    const r = validateRosterEntryFields({
      fullName: ' 张三 ',
      organization: ' 某单位 ',
      nationalId: VALID_ID,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.entry.fullName, '张三');
      assert.equal(r.entry.organization, '某单位');
      assert.equal(r.entry.nationalId, VALID_ID);
    }
  });

  it('rejects empty name', () => {
    const r = validateRosterEntryFields({
      fullName: '',
      organization: '单位',
      nationalId: VALID_ID,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.field === 'fullName'));
    }
  });

  it('rejects invalid national id', () => {
    const r = validateRosterEntryFields({
      fullName: '张三',
      organization: '单位',
      nationalId: '123',
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.field === 'nationalId'));
    }
  });
});

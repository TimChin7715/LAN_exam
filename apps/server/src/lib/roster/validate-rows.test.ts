import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateRows } from './validate-rows.js';
import { MAX_NATIONAL_ID_LENGTH } from './types.js';

describe('validateRows nationalId', () => {
  it('accepts non-standard national id in import rows', async () => {
    const { entries, errors } = await validateRows([
      {
        rowNumber: 2,
        fullName: '李四',
        organization: '测试单位',
        nationalId: 'E12345678',
      },
    ]);
    assert.equal(errors.length, 0);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.nationalId, 'E12345678');
  });

  it('rejects empty national id', async () => {
    const { entries, errors } = await validateRows([
      {
        rowNumber: 2,
        fullName: '李四',
        organization: '测试单位',
        nationalId: '',
      },
    ]);
    assert.equal(entries.length, 0);
    assert.ok(errors.some((e) => e.column === '身份证号'));
  });

  it('rejects national id over max length', async () => {
    const { entries, errors } = await validateRows([
      {
        rowNumber: 2,
        fullName: '李四',
        organization: '测试单位',
        nationalId: 'x'.repeat(MAX_NATIONAL_ID_LENGTH + 1),
      },
    ]);
    assert.equal(entries.length, 0);
    assert.ok(errors.some((e) => e.column === '身份证号'));
  });
});

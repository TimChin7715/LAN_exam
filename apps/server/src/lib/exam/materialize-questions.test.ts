import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { questionImportOrderBy } from '../qbank/question-import-order.js';

describe('questionImportOrderBy', () => {
  it('orders by importSortOrder before createdAt and id', () => {
    assert.deepEqual(questionImportOrderBy, [
      { importSortOrder: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });
});

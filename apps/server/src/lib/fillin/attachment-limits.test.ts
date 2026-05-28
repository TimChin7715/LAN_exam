import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertFillInAttachmentsWithinLimits,
  MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES,
  MAX_FILLIN_ATTACHMENTS_TOTAL_LABEL,
  MAX_FILLIN_BATCH_ATTACHMENTS,
} from './attachment-limits.js';

describe('assertFillInAttachmentsWithinLimits', () => {
  it('rejects more than max count', () => {
    const files = Array.from({ length: MAX_FILLIN_BATCH_ATTACHMENTS + 1 }, () => ({
      buffer: Buffer.alloc(1),
    }));
    const result = assertFillInAttachmentsWithinLimits(files);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.message.includes('10'));
    }
  });

  it('rejects total size over limit', () => {
    const result = assertFillInAttachmentsWithinLimits([
      { buffer: Buffer.alloc(MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES) },
      { buffer: Buffer.alloc(1) },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.message.includes(MAX_FILLIN_ATTACHMENTS_TOTAL_LABEL));
    }
  });

  it('accepts within limits', () => {
    assert.equal(
      assertFillInAttachmentsWithinLimits([
        { buffer: Buffer.alloc(1024) },
        { buffer: Buffer.alloc(2048) },
      ]).ok,
      true,
    );
  });
});

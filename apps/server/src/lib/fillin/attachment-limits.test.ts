import { describe, expect, it } from 'vitest';

import {
  assertFillInAttachmentsWithinLimits,
  MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES,
  MAX_FILLIN_BATCH_ATTACHMENTS,
} from './attachment-limits.js';

describe('assertFillInAttachmentsWithinLimits', () => {
  it('rejects more than max count', () => {
    const files = Array.from({ length: MAX_FILLIN_BATCH_ATTACHMENTS + 1 }, () => ({
      buffer: Buffer.alloc(1),
    }));
    const result = assertFillInAttachmentsWithinLimits(files);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('10');
    }
  });

  it('rejects total size over limit', () => {
    const result = assertFillInAttachmentsWithinLimits([
      { buffer: Buffer.alloc(MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES) },
      { buffer: Buffer.alloc(1) },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('50MB');
    }
  });

  it('accepts within limits', () => {
    expect(
      assertFillInAttachmentsWithinLimits([
        { buffer: Buffer.alloc(1024) },
        { buffer: Buffer.alloc(2048) },
      ]).ok,
    ).toBe(true);
  });
});

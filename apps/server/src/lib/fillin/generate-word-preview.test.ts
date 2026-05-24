import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FILLIN_PREVIEW_ASSET_PREFIX,
  isValidFillInPreviewImageName,
  previewVersionFromWordBuffer,
  rewriteFillInPreviewAssetUrls,
} from './generate-word-preview.js';

describe('generate-word-preview', () => {
  it('rewriteFillInPreviewAssetUrls injects exam-scoped asset URLs', () => {
    const html = `<img src="${FILLIN_PREVIEW_ASSET_PREFIX}0.png" />`;
    const out = rewriteFillInPreviewAssetUrls(html, 'exam-1', 'abc123');
    assert.ok(
      out.includes(
        '/api/student/exam/fillin/word/preview/asset?examId=exam-1&v=abc123&name=0.png',
      ),
    );
  });

  it('previewVersionFromWordBuffer is stable for same bytes', () => {
    const buf = Buffer.from('hello');
    assert.equal(
      previewVersionFromWordBuffer(buf),
      previewVersionFromWordBuffer(buf),
    );
  });

  it('isValidFillInPreviewImageName rejects path traversal', () => {
    assert.equal(isValidFillInPreviewImageName('0.png'), true);
    assert.equal(isValidFillInPreviewImageName('../paper.docx'), false);
  });
});

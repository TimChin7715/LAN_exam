import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';

const { window } = parseHTML('<!DOCTYPE html><html></html>');
globalThis.Node = window.Node as typeof Node;
globalThis.DOMParser = class DOMParser {
  parseFromString(source: string, mimeType: string) {
    const wrapped =
      mimeType === 'text/html'
        ? `<!DOCTYPE html><html><body>${source}</body></html>`
        : source;
    return parseHTML(wrapped).document;
  }
} as typeof DOMParser;

const { splitPreviewHtmlByQuestionRaw } = await import('./fillin-preview-split.ts');

describe('splitPreviewHtmlByQuestionRaw', () => {
  it('merges image and subsection header into previous question segment', () => {
    const html = [
      '<div class="fillin-word-paper">',
      '<p>1. 该数据是哪个金融机构反馈的数据？',
      '<input class="fillin-inline-input" data-fillin-question-no="1" data-fillin-blank-index="1" /></p>',
      '<p><img src="/preview/0.png" alt="excel" /></p>',
      '<p>（二）请根据"李一玲"2024年8月的相关资金数据，回答以下问题：</p>',
      '<p>2. 判断在哪些市活动过？',
      '<input class="fillin-inline-input" data-fillin-question-no="2" data-fillin-blank-index="1" /></p>',
      '</div>',
    ].join('');

    const segments = splitPreviewHtmlByQuestionRaw(html);
    const numbered = segments.filter((s) => s.questionNo !== null);

    assert.equal(numbered.length, 2);
    assert.equal(numbered[0]!.questionNo, '1');
    assert.equal(numbered[1]!.questionNo, '2');
    assert.match(numbered[0]!.html, /<img[\s>]/i);
    assert.ok(numbered[0]!.html.includes('（二）'));
    assert.equal(
      segments.filter((s) => s.questionNo === '1').length,
      1,
      'question 1 should appear in exactly one segment',
    );
  });

  it('does not treat 2、 as a new question', () => {
    const html = [
      '<div class="fillin-word-paper">',
      '<p>1. 首都是<input class="fillin-inline-input" data-fillin-question-no="1" data-fillin-blank-index="1" /></p>',
      '<p>2、朝代是<input class="fillin-inline-input" data-fillin-question-no="2" data-fillin-blank-index="1" /></p>',
      '</div>',
    ].join('');

    const segments = splitPreviewHtmlByQuestionRaw(html);
    const numbered = segments.filter((s) => s.questionNo !== null);

    assert.equal(numbered.length, 1);
    assert.equal(numbered[0]!.questionNo, '1');
  });
});

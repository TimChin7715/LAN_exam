/**
 * Verify A111 docx question split after dot-only numbering fix.
 * Run: node --import tsx apps/server/scripts/verify-a111-split.mjs [path/to/docx]
 */
import fs from 'node:fs';
import mammoth from 'mammoth';
import { parseHTML } from 'linkedom';

const docxPath =
  process.argv[2] ?? 'C:/Users/23891/Desktop/2025年4月初级试卷A111.docx';
const buf = fs.readFileSync(docxPath);

const { window } = parseHTML('<!DOCTYPE html><html></html>');
globalThis.Node = window.Node;
globalThis.DOMParser = class DOMParser {
  parseFromString(source, mimeType) {
    const wrapped =
      mimeType === 'text/html'
        ? `<!DOCTYPE html><html><body>${source}</body></html>`
        : source;
    return parseHTML(wrapped).document;
  }
};

const { parseWordFillText } = await import('../src/lib/fillin/parse-word-fill.ts');
const { injectWordPreviewInputs } = await import(
  '../src/lib/fillin/inject-word-preview-inputs.ts'
);
const { splitPreviewHtmlByQuestionRaw } = await import(
  '../../web/src/lib/fillin-preview-split.ts'
);

const { value: text } = await mammoth.extractRawText({ buffer: buf });
const { blanks } = parseWordFillText(text);
const { value: html } = await mammoth.convertToHtml({ buffer: buf });
const previewHtml = injectWordPreviewInputs(html, blanks);
const segments = splitPreviewHtmlByQuestionRaw(previewHtml);

const q1Segments = segments.filter((s) => s.questionNo === '1');
const q1WithShots = q1Segments.length;

console.log('Total blanks:', blanks.length);
console.log('Q1 blank count:', blanks.filter((b) => b.questionNo === 1).length);
console.log('HTML segments with questionNo=1:', q1WithShots);
console.log('Q1 segment has image:', q1Segments.some((s) => /<img[\s>]/i.test(s.html)));
console.log('Q1 segment has (二):', q1Segments.some((s) => s.html.includes('（二）')));

if (q1WithShots !== 1) {
  console.error('FAIL: expected exactly 1 segment for question 1');
  process.exit(1);
}

console.log('PASS: question 1 maps to a single preview segment');

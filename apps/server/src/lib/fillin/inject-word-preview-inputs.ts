import type { ParsedFillInBlank } from './types.js';
import {
  injectBlanksInHtmlDocumentOrder,
} from './blank-marker-html.js';
import type { InlineBlank } from './inline-input-html.js';

export {
  countBlankMarkersInHtml,
  htmlLeaksFilledAnswers,
} from './blank-marker-html.js';

/** 在 mammoth HTML 中将【答案】（x分）替换为内联输入框，保留分值展示。 */
export function injectWordPreviewInputs(
  html: string,
  blanks: ParsedFillInBlank[],
): string {
  const ordered = [...blanks].sort((a, b) => a.rowNumber - b.rowNumber);
  const inlineBlanks: InlineBlank[] = ordered.map((blank, inlineOrder) => ({
    ...blank,
    inlineOrder,
  }));
  const state = { index: 0 };

  const body =
    injectBlanksInHtmlDocumentOrder(html, inlineBlanks, state).trim() ||
    '<p class="text-muted">试卷正文为空。</p>';

  if (!body.includes('fillin-inline-input')) {
    return body;
  }

  return `<div class="fillin-word-paper">${body}</div>`;
}

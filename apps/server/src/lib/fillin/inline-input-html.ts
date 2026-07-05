import type { ParsedFillInBlank } from './types.js';

export type InlineBlank = ParsedFillInBlank & {
  inlineOrder: number;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 空位宽度对齐 Word 中【】占位（默认 4 字符，按最长候选答案扩展，上限 12）。 */
export function blankInputSize(answerKeys: string): number {
  const keys = answerKeys
    .split('|')
    .map((key) => key.trim())
    .filter(Boolean);
  const maxLen =
    keys.length > 0 ? Math.max(...keys.map((key) => key.length)) : 4;
  return Math.min(Math.max(maxLen, 4), 12);
}

export function renderInlineInput(blank: InlineBlank): string {
  const label = `第 ${blank.questionNo} 题第 ${blank.blankIndex} 空`;
  const size = blankInputSize(blank.answerKeys);
  return [
    '<span class="fillin-inline-blank-wrap">',
    '<input',
    ' class="fillin-inline-input"',
    ' type="text"',
    ' autocomplete="off"',
    ` size="${size}"`,
    ` aria-label="${escapeHtml(label)}"`,
    ` data-fillin-order="${blank.inlineOrder}"`,
    ` data-fillin-question-no="${blank.questionNo}"`,
    ` data-fillin-blank-index="${blank.blankIndex}"`,
    ' />',
    '</span>',
  ].join('');
}

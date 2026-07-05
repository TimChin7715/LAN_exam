import { renderInlineInput, type InlineBlank } from './inline-input-html.js';

/** 匹配【答案】与完整分值后缀，用于 HTML 注入 */
export const FILL_BLANK_WITH_POINTS_RE =
  /【([^】\n]+)】(\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)])/g;

/** 与 parse-word-fill.ts FILL_BLANK_RE 相同，避免循环依赖 */
const FILL_BLANK_MARKER_RE =
  /【([^】\n]+)】\s*[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[）)]/g;

/** 学员卷（已抹去答案）中的空【】与分值 */
export const EMPTY_BLANK_WITH_POINTS_RE =
  /【\s*】(\s*[（(]\s*\d+(?:\.\d+)?\s*分\s*[）)])/g;

const TABLE_CELL_RE = /<(t[dh])([^>]*)>([\s\S]*?)<\/\1>/gi;
const TABLE_BLOCK_RE = /<table[\s\S]*?<\/table>/gi;

export function mergeHtmlToPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

export function countBlankMarkersInPlainText(text: string): number {
  FILL_BLANK_MARKER_RE.lastIndex = 0;
  return [...text.matchAll(FILL_BLANK_MARKER_RE)].length;
}

export function replaceBlanksInPlainText(
  text: string,
  blanks: InlineBlank[],
  state: { index: number },
): string {
  FILL_BLANK_WITH_POINTS_RE.lastIndex = 0;
  let result = text.replace(
    FILL_BLANK_WITH_POINTS_RE,
    (_match, _answer, pointsPart: string) => {
      const blank = blanks[state.index];
      state.index += 1;
      if (!blank) {
        return _match;
      }
      return `${renderInlineInput(blank)}${pointsPart}`;
    },
  );

  EMPTY_BLANK_WITH_POINTS_RE.lastIndex = 0;
  result = result.replace(EMPTY_BLANK_WITH_POINTS_RE, (_match, pointsPart: string) => {
    const blank = blanks[state.index];
    state.index += 1;
    if (!blank) {
      return _match;
    }
    return `${renderInlineInput(blank)}${pointsPart}`;
  });

  return result;
}

/** 按 HTML 文档顺序遍历：先正文片段，再表格块（与 mammoth 输出顺序一致）。 */
export function forEachHtmlSegmentInDocumentOrder(
  html: string,
  handlers: {
    onText: (textHtml: string) => void;
    onTable: (tableHtml: string) => void;
  },
): void {
  TABLE_BLOCK_RE.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TABLE_BLOCK_RE.exec(html)) !== null) {
    if (match.index > lastIndex) {
      handlers.onText(html.slice(lastIndex, match.index));
    }
    handlers.onTable(match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    handlers.onText(html.slice(lastIndex));
  }
}

function replaceBlanksInTextHtml(
  html: string,
  blanks: InlineBlank[],
  state: { index: number },
): string {
  const parts = html.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (part.startsWith('<')) continue;
    parts[i] = replaceBlanksInPlainText(part, blanks, state);
  }
  return parts.join('');
}

function countBlanksInTextHtml(html: string): number {
  let count = 0;
  const parts = html.split(/(<[^>]+>)/g);
  for (const part of parts) {
    if (part.startsWith('<')) continue;
    count += countBlankMarkersInPlainText(part);
  }
  return count;
}

function tableHtmlLeaksFilledAnswers(tableHtml: string): boolean {
  let leaked = false;
  processHtmlTableCells(tableHtml, (plain) => {
    FILL_BLANK_WITH_POINTS_RE.lastIndex = 0;
    if (FILL_BLANK_WITH_POINTS_RE.test(plain)) {
      leaked = true;
    }
    return plain;
  });
  return leaked;
}

/** 合并表格单元格内 HTML 为连续文本后处理，写回简化 `<p>` 结构。 */
export function processHtmlTableCells(
  html: string,
  handler: (plainText: string) => string,
): string {
  return html.replace(TABLE_CELL_RE, (full, tag: string, attrs: string, inner: string) => {
    const plain = mergeHtmlToPlainText(inner);
    const next = handler(plain);
    if (next === plain) {
      return full;
    }
    return `<${tag}${attrs}><p>${next}</p></${tag}>`;
  });
}

export function injectBlanksInHtmlDocumentOrder(
  html: string,
  blanks: InlineBlank[],
  state: { index: number },
): string {
  const chunks: string[] = [];

  forEachHtmlSegmentInDocumentOrder(html, {
    onText: (textHtml) => {
      chunks.push(replaceBlanksInTextHtml(textHtml, blanks, state));
    },
    onTable: (tableHtml) => {
      chunks.push(
        processHtmlTableCells(tableHtml, (plain) =>
          replaceBlanksInPlainText(plain, blanks, state),
        ),
      );
    },
  });

  return chunks.join('');
}

export function countBlankMarkersInHtml(html: string): number {
  let count = 0;

  forEachHtmlSegmentInDocumentOrder(html, {
    onText: (textHtml) => {
      count += countBlanksInTextHtml(textHtml);
    },
    onTable: (tableHtml) => {
      processHtmlTableCells(tableHtml, (plain) => {
        count += countBlankMarkersInPlainText(plain);
        return plain;
      });
    },
  });

  return count;
}

export function htmlLeaksFilledAnswers(html: string): boolean {
  let leaked = false;

  forEachHtmlSegmentInDocumentOrder(html, {
    onText: (textHtml) => {
      if (leaked) return;
      const parts = textHtml.split(/(<[^>]+>)/g);
      for (const part of parts) {
        if (part.startsWith('<')) continue;
        FILL_BLANK_WITH_POINTS_RE.lastIndex = 0;
        if (FILL_BLANK_WITH_POINTS_RE.test(part)) {
          leaked = true;
          return;
        }
      }
    },
    onTable: (tableHtml) => {
      if (!leaked && tableHtmlLeaksFilledAnswers(tableHtml)) {
        leaked = true;
      }
    },
  });

  return leaked;
}

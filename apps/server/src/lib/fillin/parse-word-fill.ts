import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

import { countBlankMarkersInHtml, htmlLeaksFilledAnswers } from './blank-marker-html.js';
import { parseNonNegativeScore } from '../parse-score.js';
import { wordUploadExt } from '../upload/word-file.js';
import type { RowError } from './types.js';
import type { ParsedFillInBlank } from './types.js';

const QUESTION_SPLIT_RE = /(?:^|\n)\s*(\d+)\.\s*/g;

/** 一空：【答案|答案】（2分）或半角括号 */
export const FILL_BLANK_RE =
  /【([^】\n]+)】\s*[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[）)]/g;

const SAMPLE_PREFIXES = ['【示例】', '【说明】'] as const;

const UNSUPPORTED_BLANK_MARKER_RULES = [
  { re: /_{2,}|＿{2,}/, example: '____' },
  { re: /（）|\(\)/, example: '（）' },
  { re: /\[\s*\]|［\s*］/, example: '[]' },
  { re: /【\s*】/, example: '空【】' },
] as const;

const BARE_BRACKET_RE = /【([^】\n]+)】/g;

function findBareBracketsWithoutPoints(text: string): string[] {
  const withoutValid = text.replace(FILL_BLANK_RE, '');
  const found: string[] = [];
  BARE_BRACKET_RE.lastIndex = 0;
  for (const match of withoutValid.matchAll(BARE_BRACKET_RE)) {
    const inner = match[1]!.trim();
    if (!inner) continue;
    if (inner === '示例' || inner === '说明') continue;
    found.push(`【${inner}】`);
  }
  return found;
}

export function splitAcceptedAnswers(answerText: string): string[] {
  return answerText
    .split(/[|｜]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

function isTemplateHelperText(text: string): boolean {
  return SAMPLE_PREFIXES.some((prefix) => text.trim().startsWith(prefix));
}

function findUnsupportedBlankMarker(text: string): string | null {
  const withoutFilledBlanks = text.replace(FILL_BLANK_RE, '');
  for (const rule of UNSUPPORTED_BLANK_MARKER_RULES) {
    rule.re.lastIndex = 0;
    if (rule.re.test(withoutFilledBlanks)) {
      return rule.example;
    }
  }
  return null;
}

async function extractWordText(buffer: Buffer, filename?: string): Promise<string> {
  const ext = wordUploadExt(filename);
  if (ext === 'doc') {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    return doc.getBody();
  }
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

type QuestionSegment = {
  questionNo: number;
  stem: string;
  lineOffset: number;
};

function extractOrphanQuestionStem(preamble: string): string | null {
  const blocks = preamble.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i]!;
    if (isTemplateHelperText(block)) continue;
    FILL_BLANK_RE.lastIndex = 0;
    if (FILL_BLANK_RE.test(block)) {
      return block;
    }
  }
  return null;
}

function splitQuestionSegments(text: string): QuestionSegment[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const matches: { index: number; length: number; questionNo: number }[] = [];
  let m: RegExpExecArray | null;
  QUESTION_SPLIT_RE.lastIndex = 0;
  while ((m = QUESTION_SPLIT_RE.exec(normalized)) !== null) {
    matches.push({
      index: m.index,
      length: m[0].length,
      questionNo: parseInt(m[1]!, 10),
    });
  }

  if (matches.length === 0) {
    return [{ questionNo: 1, stem: normalized, lineOffset: 1 }];
  }

  const segments: QuestionSegment[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!;
    const next = matches[i + 1];
    const bodyStart = cur.index + cur.length;
    const bodyEnd = next ? next.index : normalized.length;
    const stem = normalized.slice(bodyStart, bodyEnd).trim();
    const lineOffset =
      normalized.slice(0, cur.index).split('\n').length;
    if (stem && !isTemplateHelperText(stem)) {
      segments.push({ questionNo: cur.questionNo, stem, lineOffset });
    }
  }

  if (matches.length > 0 && matches[0]!.questionNo >= 2) {
    const orphanStem = extractOrphanQuestionStem(
      normalized.slice(0, matches[0]!.index),
    );
    if (orphanStem) {
      segments.unshift({
        questionNo: matches[0]!.questionNo - 1,
        stem: orphanStem,
        lineOffset: 1,
      });
    }
  }

  return segments;
}

export function parseWordFillText(text: string): {
  blanks: ParsedFillInBlank[];
  errors: RowError[];
} {
  const segments = splitQuestionSegments(text);
  const blanks: ParsedFillInBlank[] = [];
  const errors: RowError[] = [];

  if (segments.length === 0) {
    return {
      blanks: [],
      errors: [{ row: 0, message: 'Word 正文为空，无法导入操作题。' }],
    };
  }

  let globalBlankOrder = 0;

  for (const segment of segments) {
    const unsupported = findUnsupportedBlankMarker(segment.stem);
    if (unsupported) {
      errors.push({
        row: segment.lineOffset,
        column: '题干',
        message: `第 ${segment.questionNo} 题：空位须使用【答案】（分值）格式，不要使用 ${unsupported}。`,
      });
      continue;
    }

    const blankIndexByQuestion = new Map<number, number>();
    FILL_BLANK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let foundInQuestion = 0;

    while ((match = FILL_BLANK_RE.exec(segment.stem)) !== null) {
      foundInQuestion += 1;
      globalBlankOrder += 1;
      const answerRaw = match[1]!.trim();
      const pointsRaw = match[2]!;
      const points = parseNonNegativeScore(pointsRaw);
      if (points === null) {
        errors.push({
          row: segment.lineOffset,
          column: '分值',
          message: `第 ${segment.questionNo} 题第 ${foundInQuestion} 空：分值须为非负数字（上限 1000）。`,
        });
        continue;
      }

      const accepted = splitAcceptedAnswers(answerRaw);
      if (accepted.length === 0) {
        errors.push({
          row: segment.lineOffset,
          column: '答案',
          message: `第 ${segment.questionNo} 题第 ${foundInQuestion} 空：【】内须填写标准答案。`,
        });
        continue;
      }

      const blankIndex =
        (blankIndexByQuestion.get(segment.questionNo) ?? 0) + 1;
      blankIndexByQuestion.set(segment.questionNo, blankIndex);

      blanks.push({
        rowNumber: globalBlankOrder,
        questionNo: segment.questionNo,
        blankIndex,
        stem: segment.stem,
        answerKeys: accepted.join('|'),
        points,
      });
    }

    if (foundInQuestion > 0) {
      const bareInSegment = findBareBracketsWithoutPoints(segment.stem);
      if (bareInSegment.length > 0) {
        errors.push({
          row: segment.lineOffset,
          message: `第 ${segment.questionNo} 题：${bareInSegment[0]} 缺少（分值），请写为【答案】（2分）；表格单元格内亦须在同一格写完整格式。`,
        });
      }
    } else if (!isTemplateHelperText(segment.stem)) {
      const bare = findBareBracketsWithoutPoints(segment.stem);
      if (bare.length > 0) {
        errors.push({
          row: segment.lineOffset,
          message: `第 ${segment.questionNo} 题：${bare[0]} 缺少（分值），请写为【答案】（2分）；表格单元格内亦须在同一格写完整格式。`,
        });
      }
    }
  }

  if (blanks.length === 0 && errors.length === 0) {
    const bare = findBareBracketsWithoutPoints(
      segments.map((segment) => segment.stem).join('\n'),
    );
    if (bare.length > 0) {
      errors.push({
        row: 0,
        message: `发现 ${bare[0]} 等空位缺少（分值），请写为【答案】（2分）；表格单元格内亦须在同一格写完整格式。`,
      });
    } else {
      errors.push({
        row: 0,
        message:
          '未找到可导入的空位。请确认每空使用【答案】（分值）格式，例如【北京|北平】（2分）；并删除【示例】/【说明】行。',
      });
    }
  }

  return { blanks, errors };
}

export async function parseWordFillDocument(
  buffer: Buffer,
  filename?: string,
): Promise<{ blanks: ParsedFillInBlank[]; errors: RowError[] }> {
  const text = await extractWordText(buffer, filename);
  return parseWordFillText(text);
}

/** 统计 HTML 文本中可替换的空位数量（用于导入校验） */
export function countWordBlankMarkersInHtml(html: string): number {
  return countBlankMarkersInHtml(html);
}

/** 预览 HTML 中是否仍残留【标准答案】（分值）文本 */
export function previewHtmlLeaksFilledAnswers(html: string): boolean {
  return htmlLeaksFilledAnswers(html);
}

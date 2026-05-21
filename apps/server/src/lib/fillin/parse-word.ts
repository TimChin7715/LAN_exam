import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

import { wordUploadExt } from '../upload/word-file.js';
import type { WordQuestionSegment } from './types.js';

const QUESTION_SPLIT_RE = /(?:^|\n)\s*(\d+)\s*[\.、\)]\s*/g;

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

export async function parseWordQuestions(
  buffer: Buffer,
  filename?: string,
): Promise<WordQuestionSegment[]> {
  const text = await extractWordText(buffer, filename);
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const segments: WordQuestionSegment[] = [];
  const matches: { index: number; questionNo: number }[] = [];
  let m: RegExpExecArray | null;
  QUESTION_SPLIT_RE.lastIndex = 0;
  while ((m = QUESTION_SPLIT_RE.exec(normalized)) !== null) {
    matches.push({ index: m.index, questionNo: parseInt(m[1]!, 10) });
  }

  if (matches.length === 0) {
    return [];
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!;
    const next = matches[i + 1];
    const headerEnd = normalized.indexOf('.', cur.index) + 1;
    const altEnd = normalized.indexOf('、', cur.index) + 1;
    const parenEnd = normalized.indexOf(')', cur.index) + 1;
    const endMarker = Math.max(headerEnd, altEnd, parenEnd, cur.index + 1);
    const bodyStart =
      normalized[endMarker] === ' ' || normalized[endMarker] === '\n'
        ? endMarker + 1
        : endMarker;
    const bodyEnd = next ? next.index : normalized.length;
    const stem = normalized.slice(bodyStart, bodyEnd).trim();
    if (stem) {
      segments.push({ questionNo: cur.questionNo, stem });
    }
  }

  return segments;
}

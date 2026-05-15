import type { QuestionType } from '@prisma/client';

export function splitAnswerTokens(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,，、\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((k) => /^[A-Z]$/.test(k)),
    ),
  ].sort();
}

export function normalizeJudgeAnswer(raw: string): 'A' | 'B' | null {
  const v = raw.trim();
  if (v === 'A' || v === '正确') return 'A';
  if (v === 'B' || v === '错误') return 'B';
  return null;
}

export function normalizeAnswerKeys(
  type: QuestionType,
  raw: string,
  optionKeys: string[],
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (type === 'JUDGE') {
    const judge = normalizeJudgeAnswer(trimmed);
    return judge;
  }

  if (type === 'SINGLE') {
    const letter = trimmed.toUpperCase();
    if (!/^[A-Z]$/.test(letter) || !optionKeys.includes(letter)) return null;
    return letter;
  }

  const tokens = splitAnswerTokens(trimmed);
  if (tokens.length === 0) return null;
  const invalid = tokens.some((k) => !optionKeys.includes(k));
  if (invalid) return null;
  return tokens.join(',');
}

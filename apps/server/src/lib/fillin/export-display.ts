export type FillInBlankSpec = { blankIndex: number; answers: string[] };

/** 学员作答展示：新格式纯文本；旧格式 JSON 合并为可读文本 */
export function displayFillAnswer(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return raw;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') return raw;
    return Object.entries(parsed)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, v]) => v)
      .filter(Boolean)
      .join('；');
  } catch {
    return raw;
  }
}

/** 管理端预览：新格式为 答案|别名；旧格式为 JSON 多空 */
export function parseFillBlankSpecs(answerKeys: string): FillInBlankSpec[] {
  const trimmed = answerKeys.trim();
  if (!trimmed.startsWith('[')) {
    const answers = trimmed
      .split(/[|｜]/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (answers.length === 0) return [];
    return [{ blankIndex: 1, answers }];
  }
  try {
    const parsed = JSON.parse(answerKeys) as FillInBlankSpec[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatFillAnswerKeysPreview(answerKeys: string): string {
  const specs = parseFillBlankSpecs(answerKeys);
  if (specs.length === 0) return '—';
  return specs
    .map((b) =>
      specs.length > 1
        ? `空 ${b.blankIndex}：${b.answers.join(' / ')}`
        : b.answers.join(' / '),
    )
    .join('；');
}

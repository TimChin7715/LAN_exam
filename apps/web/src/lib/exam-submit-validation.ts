import { parseFillQuestionNo } from '@/lib/fillin';
import {
  hasExamModule,
  needsFillIn,
  needsPractical,
  type ExamContentModule,
  type ExamPaperItem,
  type PracticalPaperMeta,
} from '@/lib/student';

function parseMultiKeys(raw: string): string[] {
  return raw
    .split(/[,\uFF0C\u3001\s]+/)
    .map((k) => k.trim().toUpperCase())
    .filter((k) => /^[A-Z]$/.test(k));
}

export function isPaperItemAnswered(
  item: ExamPaperItem,
  selectedRaw: string,
): boolean {
  if (item.type === 'MULTI') {
    return parseMultiKeys(selectedRaw).length > 0;
  }
  return selectedRaw.trim().length > 0;
}

function shouldCheckPaperItem(
  item: ExamPaperItem,
  contentModules: ExamContentModule[],
): boolean {
  if (item.type === 'FILL') {
    return needsFillIn(contentModules);
  }
  return hasExamModule(contentModules, 'OBJECTIVE');
}

function buildFillMultiBlankCounts(
  items: ExamPaperItem[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.type !== 'FILL') continue;
    const key = item.fillQuestionNo ?? item.examQuestionId;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function formatPaperItemLabel(
  item: ExamPaperItem,
  objectiveSorted: ExamPaperItem[],
  fillMultiBlankCounts: Map<string, number>,
): string {
  if (item.type === 'FILL') {
    const qNo = parseFillQuestionNo(item.fillQuestionNo) ?? '—';
    const groupKey = item.fillQuestionNo ?? item.examQuestionId;
    const multiBlank = (fillMultiBlankCounts.get(groupKey) ?? 0) > 1;
    const blankSuffix =
      multiBlank && item.fillBlankIndex ? `-${item.fillBlankIndex}` : '';
    return `题号 ${qNo}${blankSuffix}`;
  }
  const index = objectiveSorted.findIndex(
    (row) => row.examQuestionId === item.examQuestionId,
  );
  return index >= 0 ? `第 ${index + 1} 题` : '未知题';
}

export type SubmitBlockers = {
  canSubmit: boolean;
  missingPractical: boolean;
  missingQuestionLabels: string[];
};

export function collectSubmitBlockers(input: {
  items: ExamPaperItem[];
  answers: Record<string, string>;
  contentModules: ExamContentModule[];
  practical: PracticalPaperMeta | null;
}): SubmitBlockers {
  const { items, answers, contentModules, practical } = input;

  const objectiveSorted = [...items]
    .filter((item) => item.type !== 'FILL')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const fillMultiBlankCounts = buildFillMultiBlankCounts(items);

  const missingQuestionLabels: string[] = [];
  for (const item of items) {
    if (!shouldCheckPaperItem(item, contentModules)) continue;
    if (!isPaperItemAnswered(item, answers[item.examQuestionId] ?? '')) {
      missingQuestionLabels.push(
        formatPaperItemLabel(item, objectiveSorted, fillMultiBlankCounts),
      );
    }
  }

  const missingPractical =
    needsPractical(contentModules) && !practical?.hasAnswerDraft;

  return {
    canSubmit: missingQuestionLabels.length === 0 && !missingPractical,
    missingPractical,
    missingQuestionLabels,
  };
}

export function formatSubmitBlockerMessage(blockers: SubmitBlockers): string {
  const parts: string[] = [];
  if (blockers.missingQuestionLabels.length > 0) {
    parts.push(
      `以下题目尚未作答：${blockers.missingQuestionLabels.join('、')}`,
    );
  }
  if (blockers.missingPractical) {
    parts.push('操作题尚未上传作答 Word 文档');
  }
  if (parts.length === 0) {
    return '';
  }
  return `${parts.join('；')}。请完成后再提交。`;
}

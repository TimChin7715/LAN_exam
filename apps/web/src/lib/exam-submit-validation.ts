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

function formatCircleLabel(
  item: ExamPaperItem,
  objectiveIndex: number,
  fillMultiBlankCounts: Map<string, number>,
): string {
  if (item.type === 'FILL') {
    const qNo = parseFillQuestionNo(item.fillQuestionNo) ?? '—';
    const groupKey = item.fillQuestionNo ?? item.examQuestionId;
    const multiBlank = (fillMultiBlankCounts.get(groupKey) ?? 0) > 1;
    const blankSuffix =
      multiBlank && item.fillBlankIndex ? `-${item.fillBlankIndex}` : '';
    return `${qNo}${blankSuffix}`;
  }
  return String(objectiveIndex);
}

export type AnswerProgressSection = 'objective' | 'fill' | 'practical';

export type AnswerProgressRow = {
  key: string;
  section: AnswerProgressSection;
  label: string;
  circleLabel: string;
  answered: boolean;
};

export type AnswerProgressSummary = {
  rows: AnswerProgressRow[];
  answeredCount: number;
  totalCount: number;
  allAnswered: boolean;
};

function paperItemSection(item: ExamPaperItem): 'objective' | 'fill' {
  return item.type === 'FILL' ? 'fill' : 'objective';
}

function buildPaperProgressRows(input: {
  items: ExamPaperItem[];
  answers: Record<string, string>;
  contentModules: ExamContentModule[];
}): AnswerProgressRow[] {
  const { items, answers, contentModules } = input;
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const objectiveSorted = sorted.filter((item) => item.type !== 'FILL');
  const fillMultiBlankCounts = buildFillMultiBlankCounts(items);

  const rows: AnswerProgressRow[] = [];
  let objectiveIndex = 0;
  for (const item of sorted) {
    if (!shouldCheckPaperItem(item, contentModules)) continue;
    const answered = isPaperItemAnswered(
      item,
      answers[item.examQuestionId] ?? '',
    );
    if (item.type !== 'FILL') {
      objectiveIndex += 1;
    }
    rows.push({
      key: item.examQuestionId,
      section: paperItemSection(item),
      label: formatPaperItemLabel(item, objectiveSorted, fillMultiBlankCounts),
      circleLabel:
        item.type === 'FILL'
          ? formatCircleLabel(item, 0, fillMultiBlankCounts)
          : formatCircleLabel(item, objectiveIndex, fillMultiBlankCounts),
      answered,
    });
  }
  return rows;
}

export function buildAnswerProgressSummary(input: {
  items: ExamPaperItem[];
  answers: Record<string, string>;
  contentModules: ExamContentModule[];
  practical: PracticalPaperMeta | null;
}): AnswerProgressSummary {
  const { items, answers, contentModules, practical } = input;

  const rows = buildPaperProgressRows({ items, answers, contentModules });

  if (needsPractical(contentModules)) {
    const answered = Boolean(practical?.hasAnswerDraft);
    rows.push({
      key: 'practical',
      section: 'practical',
      label: '操作题',
      circleLabel: '操',
      answered,
    });
  }

  const answeredCount = rows.filter((row) => row.answered).length;
  const totalCount = rows.length;
  const blockers = collectSubmitBlockers(input);

  return {
    rows,
    answeredCount,
    totalCount,
    allAnswered: blockers.canSubmit,
  };
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
  const { contentModules, practical } = input;

  const rows = buildPaperProgressRows(input);
  const missingQuestionLabels = rows
    .filter((row) => !row.answered)
    .map((row) => row.label);

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

export function formatSubmitConfirmDescription(blockers: SubmitBlockers): string {
  if (blockers.canSubmit) {
    return '提交后将无法修改答案。';
  }
  const warning = formatSubmitBlockerMessage(blockers).replace(
    /。请完成后再提交。$/,
    '',
  );
  return `${warning}。是否仍要提交？`;
}

import type { QuestionType } from '@prisma/client';
import ExcelJS from 'exceljs';

import {
  displayFillAnswer,
  formatFillAnswerKeysPreview,
} from '../fillin/export-display.js';
import { prisma } from '../prisma.js';
import { buildSummaryRowQuestionFields } from './export-summary.js';
import { maskNationalId } from './mask-national-id.js';

export type SummaryExamQuestion = {
  id: string;
  sortOrder: number;
  type: QuestionType;
  fillQuestionNo: string | null;
  fillBlankIndex: string | null;
};

function summaryColumnHeader(eq: SummaryExamQuestion): string {
  const base = `第${eq.sortOrder + 1}题`;
  if (eq.type !== 'FILL') return base;
  const qNo = eq.fillQuestionNo?.trim();
  const blank = eq.fillBlankIndex?.trim();
  if (!qNo) return base;
  const suffix = blank ? `题号${qNo}-${blank}` : `题号${qNo}`;
  return `${base}(${suffix})`;
}

/** Fixed 6 + dynamic 第k题 columns — shared by production and tests. */
export function buildSummarySheetColumns(examQuestions: SummaryExamQuestion[]) {
  return [
    { header: '姓名', key: 'name', width: 16 },
    { header: '单位', key: 'organization', width: 24 },
    { header: '身份证号', key: 'id', width: 22 },
    { header: '总分', key: 'score', width: 10 },
    { header: '是否提交', key: 'submitted', width: 12 },
    { header: '提交时间', key: 'time', width: 20 },
    ...examQuestions.map((eq) => ({
      header: summaryColumnHeader(eq),
      key: `q_${eq.id}`,
      width: 14,
    })),
  ];
}

export const OBJECTIVE_DETAIL_HEADERS = [
  '姓名',
  '单位',
  '身份证号',
  '题号',
  '题型',
  '所选',
  '正确答案',
  '对错',
  '得分',
] as const;

export const FILL_IN_DETAIL_HEADERS = [
  '姓名',
  '单位',
  '身份证号',
  '题序',
  '答题卡题号',
  '空位',
  '学员作答',
  '参考答案',
  '对错',
  '得分',
  '满分',
] as const;

function questionTypeLabelZh(type: QuestionType): string {
  switch (type) {
    case 'SINGLE':
      return '单选';
    case 'MULTI':
      return '多选';
    case 'JUDGE':
      return '判断';
    case 'FILL':
      return '填空';
    default:
      return type;
  }
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toSummaryExamQuestion(row: {
  id: string;
  sortOrder: number;
  question: {
    type: QuestionType;
    knowledgePoints: string | null;
    explanation: string | null;
  };
}): SummaryExamQuestion {
  const isFill = row.question.type === 'FILL';
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    type: row.question.type,
    fillQuestionNo: isFill ? row.question.knowledgePoints : null,
    fillBlankIndex: isFill ? row.question.explanation : null,
  };
}

/**
 * Builds exam export: 成绩汇总 + 答题明细（客观）+ 填空题明细.
 * v1 scale note: ~2000 roster × ~200 questions is the practical upper bound.
 */
export async function buildExamExportWorkbook(
  examId: string,
): Promise<ExcelJS.Workbook> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      rosterBatchId: true,
    },
  });

  if (!exam) {
    throw new Error('EXAM_NOT_FOUND');
  }

  const examQuestionRows = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      sortOrder: true,
      question: {
        select: {
          type: true,
          knowledgePoints: true,
          explanation: true,
          points: true,
        },
      },
    },
  });

  const examQuestions = examQuestionRows.map(toSummaryExamQuestion);

  const rosterEntries = await prisma.rosterEntry.findMany({
    where: { batchId: exam.rosterBatchId },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
      organization: true,
      nationalId: true,
      submissions: {
        where: { examId },
        take: 1,
        select: {
          totalScore: true,
          submittedAt: true,
          answers: {
            select: {
              selectedKeys: true,
              isCorrect: true,
              pointsAwarded: true,
              examQuestion: {
                select: {
                  id: true,
                  sortOrder: true,
                  question: {
                    select: {
                      type: true,
                      answerKeys: true,
                      knowledgePoints: true,
                      explanation: true,
                      points: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LAN Exam';

  const summarySheet = workbook.addWorksheet('成绩汇总');
  summarySheet.columns = buildSummarySheetColumns(examQuestions);
  summarySheet.getRow(1).font = { bold: true };

  for (const entry of rosterEntries) {
    const submission = entry.submissions[0];
    summarySheet.addRow({
      name: entry.fullName,
      organization: entry.organization,
      id: maskNationalId(entry.nationalId),
      score: submission ? submission.totalScore : '—',
      submitted: submission ? '已提交' : '未提交',
      time: submission ? formatDateTime(submission.submittedAt) : '',
      ...buildSummaryRowQuestionFields(examQuestions, submission),
    });
  }

  const detailSheet = workbook.addWorksheet('答题明细');
  detailSheet.columns = OBJECTIVE_DETAIL_HEADERS.map((header, i) => ({
    header,
    key: ['name', 'organization', 'id', 'num', 'type', 'selected', 'correct', 'right', 'points'][i]!,
    width: header === '单位' ? 24 : header === '身份证号' ? 22 : 10,
  }));
  detailSheet.getRow(1).font = { bold: true };

  const fillInSheet = workbook.addWorksheet('填空题明细');
  fillInSheet.columns = FILL_IN_DETAIL_HEADERS.map((header, i) => ({
    header,
    key: [
      'name',
      'organization',
      'id',
      'num',
      'fillNo',
      'blank',
      'selected',
      'correct',
      'right',
      'points',
      'maxPoints',
    ][i]!,
    width:
      header === '单位'
        ? 24
        : header === '身份证号'
          ? 22
          : header === '学员作答' || header === '参考答案'
            ? 20
            : 10,
  }));
  fillInSheet.getRow(1).font = { bold: true };

  for (const entry of rosterEntries) {
    const submission = entry.submissions[0];
    if (!submission) continue;

    const sortedAnswers = [...submission.answers].sort(
      (a, b) => a.examQuestion.sortOrder - b.examQuestion.sortOrder,
    );

    for (const answer of sortedAnswers) {
      const q = answer.examQuestion.question;
      if (q.type === 'FILL') {
        fillInSheet.addRow({
          name: entry.fullName,
          organization: entry.organization,
          id: maskNationalId(entry.nationalId),
          num: answer.examQuestion.sortOrder + 1,
          fillNo: q.knowledgePoints?.trim() || '—',
          blank: q.explanation?.trim() || '—',
          selected: displayFillAnswer(answer.selectedKeys) || '—',
          correct: formatFillAnswerKeysPreview(q.answerKeys),
          right: answer.isCorrect ? '是' : '否',
          points: answer.pointsAwarded,
          maxPoints: q.points,
        });
        continue;
      }

      detailSheet.addRow({
        name: entry.fullName,
        organization: entry.organization,
        id: maskNationalId(entry.nationalId),
        num: answer.examQuestion.sortOrder + 1,
        type: questionTypeLabelZh(q.type),
        selected: answer.selectedKeys || '—',
        correct: q.answerKeys,
        right: answer.isCorrect ? '是' : '否',
        points: answer.pointsAwarded,
      });
    }
  }

  return workbook;
}

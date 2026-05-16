import type { QuestionType } from '@prisma/client';
import ExcelJS from 'exceljs';

import { prisma } from '../prisma.js';
import { maskNationalId } from './mask-national-id.js';

function questionTypeLabelZh(type: QuestionType): string {
  switch (type) {
    case 'SINGLE':
      return '单选';
    case 'MULTI':
      return '多选';
    case 'JUDGE':
      return '判断';
    default:
      return type;
  }
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Builds dual-sheet exam export. v1 scale note: ~2000 roster × ~200 questions
 * is the practical upper bound before streaming/chunking is required.
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

  const rosterEntries = await prisma.rosterEntry.findMany({
    where: { batchId: exam.rosterBatchId },
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      fullName: true,
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
                  sortOrder: true,
                  question: {
                    select: {
                      type: true,
                      answerKeys: true,
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
  summarySheet.columns = [
    { header: '姓名', key: 'name', width: 16 },
    { header: '身份证号', key: 'id', width: 22 },
    { header: '总分', key: 'score', width: 10 },
    { header: '是否提交', key: 'submitted', width: 12 },
    { header: '提交时间', key: 'time', width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true };

  for (const entry of rosterEntries) {
    const submission = entry.submissions[0];
    summarySheet.addRow({
      name: entry.fullName,
      id: maskNationalId(entry.nationalId),
      score: submission ? submission.totalScore : '—',
      submitted: submission ? '已提交' : '未提交',
      time: submission ? formatDateTime(submission.submittedAt) : '',
    });
  }

  const detailSheet = workbook.addWorksheet('答题明细');
  detailSheet.columns = [
    { header: '姓名', key: 'name', width: 16 },
    { header: '身份证号', key: 'id', width: 22 },
    { header: '题号', key: 'num', width: 8 },
    { header: '题型', key: 'type', width: 10 },
    { header: '所选', key: 'selected', width: 16 },
    { header: '正确答案', key: 'correct', width: 16 },
    { header: '对错', key: 'right', width: 8 },
    { header: '得分', key: 'points', width: 8 },
  ];
  detailSheet.getRow(1).font = { bold: true };

  for (const entry of rosterEntries) {
    const submission = entry.submissions[0];
    if (!submission) continue;

    const sortedAnswers = [...submission.answers].sort(
      (a, b) => a.examQuestion.sortOrder - b.examQuestion.sortOrder,
    );

    for (const answer of sortedAnswers) {
      detailSheet.addRow({
        name: entry.fullName,
        id: maskNationalId(entry.nationalId),
        num: answer.examQuestion.sortOrder + 1,
        type: questionTypeLabelZh(answer.examQuestion.question.type),
        selected: answer.selectedKeys || '—',
        correct: answer.examQuestion.question.answerKeys,
        right: answer.isCorrect ? '是' : '否',
        points: answer.pointsAwarded,
      });
    }
  }

  return workbook;
}

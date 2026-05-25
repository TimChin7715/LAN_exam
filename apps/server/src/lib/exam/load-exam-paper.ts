import type { PrismaClient } from '@prisma/client';

import {
  requiresFillInBatch,
  requiresPracticalBatch,
} from './content-mode.js';
import {
  getCachedExamPaperStatic,
  getCachedScoreableQuestions,
  setExamPaperCache,
  type ExamPaperStaticFillIn,
  type ExamPaperStaticPayload,
  type ExamPaperStaticPracticalMeta,
  type ScoreableExamQuestion,
} from './exam-paper-cache.js';
import { safeFillInAttachmentsZipFilename } from '../fillin/build-attachments-zip.js';
import { listFillInBatchAttachments } from '../fillin/load-batch-attachments.js';
import { prisma } from '../prisma.js';

export type ExamPaperDrafts = {
  answerDrafts: Map<string, string>;
  practical: {
    batchTitle: string;
    wordFileName: string;
    excelFileName: string;
    hasAnswerDraft: boolean;
    answerFileName: string | null;
    answerUpdatedAt: string | null;
  } | null;
};

export type ExamPaperResponse = {
  examId: string;
  contentModules: ExamPaperStaticPayload['contentModules'];
  items: Array<
    ExamPaperStaticPayload['items'][number] & { selectedKeys: string }
  >;
  practical: ExamPaperDrafts['practical'];
  fillIn: ExamPaperStaticFillIn | null;
};

async function loadStaticFromDb(
  db: PrismaClient,
  examId: string,
): Promise<{
  staticPayload: ExamPaperStaticPayload;
  scoreableQuestions: ScoreableExamQuestion[];
} | null> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      contentModules: true,
      fillInBatch: {
        select: {
          id: true,
          title: true,
          wordFileName: true,
          excelFileName: true,
        },
      },
      practicalBatch: {
        select: {
          title: true,
          wordFileName: true,
          excelFileName: true,
        },
      },
    },
  });

  if (!exam) {
    return null;
  }

  const examQuestions = await db.examQuestion.findMany({
    where: { examId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      sortOrder: true,
      question: {
        select: {
          id: true,
          type: true,
          stem: true,
          points: true,
          knowledgePoints: true,
          explanation: true,
          answerKeys: true,
          multiScoringRule: true,
          options: {
            orderBy: { sortOrder: 'asc' },
            select: {
              key: true,
              text: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });

  let fillIn: ExamPaperStaticFillIn | null = null;
  if (requiresFillInBatch(exam.contentModules) && exam.fillInBatch) {
    const batchAttachments = await listFillInBatchAttachments(
      db,
      exam.fillInBatch.id,
    );
    fillIn = {
      batchTitle: exam.fillInBatch.title,
      wordFileName: exam.fillInBatch.wordFileName,
      excelFileName: exam.fillInBatch.excelFileName,
      hasAttachments: batchAttachments.length > 0,
      attachmentZipFileName:
        batchAttachments.length > 0
          ? safeFillInAttachmentsZipFilename(exam.fillInBatch.title)
          : null,
    };
  }

  let practicalMeta: ExamPaperStaticPracticalMeta | null = null;
  if (requiresPracticalBatch(exam.contentModules) && exam.practicalBatch) {
    practicalMeta = {
      batchTitle: exam.practicalBatch.title,
      wordFileName: exam.practicalBatch.wordFileName,
      excelFileName: exam.practicalBatch.excelFileName,
    };
  }

  const items = examQuestions.map((eq) => ({
    examQuestionId: eq.id,
    sortOrder: eq.sortOrder,
    type: eq.question.type,
    stem: eq.question.stem,
    points: eq.question.points,
    fillQuestionNo:
      eq.question.type === 'FILL' ? eq.question.knowledgePoints : null,
    fillBlankIndex:
      eq.question.type === 'FILL' ? eq.question.explanation : null,
    options: eq.question.options,
  }));

  const scoreableQuestions: ScoreableExamQuestion[] = examQuestions.map(
    (eq) => ({
      examQuestionId: eq.id,
      sortOrder: eq.sortOrder,
      type: eq.question.type,
      answerKeys: eq.question.answerKeys,
      points: eq.question.points,
      multiScoringRule: eq.question.multiScoringRule,
      optionKeys: eq.question.options.map((o) => o.key),
      stem: eq.question.stem,
      knowledgePoints: eq.question.knowledgePoints,
      explanation: eq.question.explanation,
    }),
  );

  const staticPayload: ExamPaperStaticPayload = {
    examId,
    contentModules: exam.contentModules,
    items,
    fillIn,
    practicalMeta,
  };

  return { staticPayload, scoreableQuestions };
}

export async function loadExamPaperStatic(
  examId: string,
): Promise<ExamPaperStaticPayload | null> {
  const cached = getCachedExamPaperStatic(examId);
  if (cached) {
    return cached;
  }

  const loaded = await loadStaticFromDb(prisma, examId);
  if (!loaded) {
    return null;
  }

  setExamPaperCache(examId, loaded);
  return loaded.staticPayload;
}

export function getScoreableQuestionsForExam(
  examId: string,
): ScoreableExamQuestion[] | null {
  return getCachedScoreableQuestions(examId);
}

export async function loadExamPaperDrafts(
  examId: string,
  rosterEntryId: string,
  staticPayload: ExamPaperStaticPayload,
): Promise<ExamPaperDrafts> {
  const drafts = await prisma.answerDraft.findMany({
    where: { examId, rosterEntryId },
    select: {
      examQuestionId: true,
      selectedKeys: true,
    },
  });

  const answerDrafts = new Map(
    drafts.map((d) => [d.examQuestionId, d.selectedKeys]),
  );

  let practical: ExamPaperDrafts['practical'] = null;
  if (staticPayload.practicalMeta) {
    const practicalDraft = await prisma.practicalAnswerDraft.findUnique({
      where: { examId_rosterEntryId: { examId, rosterEntryId } },
      select: { docxFileName: true, updatedAt: true },
    });
    practical = {
      batchTitle: staticPayload.practicalMeta.batchTitle,
      wordFileName: staticPayload.practicalMeta.wordFileName,
      excelFileName: staticPayload.practicalMeta.excelFileName,
      hasAnswerDraft: Boolean(practicalDraft),
      answerFileName: practicalDraft?.docxFileName ?? null,
      answerUpdatedAt: practicalDraft?.updatedAt.toISOString() ?? null,
    };
  }

  return { answerDrafts, practical };
}

export function mergePaperResponse(
  staticPayload: ExamPaperStaticPayload,
  drafts: ExamPaperDrafts,
): ExamPaperResponse {
  return {
    examId: staticPayload.examId,
    contentModules: staticPayload.contentModules,
    items: staticPayload.items.map((item) => ({
      ...item,
      selectedKeys: drafts.answerDrafts.get(item.examQuestionId) ?? '',
    })),
    fillIn: staticPayload.fillIn,
    practical: drafts.practical,
  };
}

export async function buildExamPaperResponse(
  examId: string,
  rosterEntryId: string,
): Promise<ExamPaperResponse | null> {
  const staticPayload = await loadExamPaperStatic(examId);
  if (!staticPayload) {
    return null;
  }
  const drafts = await loadExamPaperDrafts(examId, rosterEntryId, staticPayload);
  return mergePaperResponse(staticPayload, drafts);
}

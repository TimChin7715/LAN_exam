import type { ExamContentModule, MultiScoringRule, QuestionType } from '@prisma/client';

import { prisma } from '../prisma.js';

export type ExamPaperStaticItem = {
  examQuestionId: string;
  sortOrder: number;
  type: QuestionType;
  stem: string;
  points: number;
  fillQuestionNo: string | null;
  fillBlankIndex: string | null;
  options: { key: string; text: string; sortOrder: number }[];
};

export type ExamPaperStaticFillIn = {
  batchTitle: string;
  wordFileName: string;
  excelFileName: string | null;
  hasAttachments: boolean;
  attachmentZipFileName: string | null;
};

export type ExamPaperStaticPayload = {
  examId: string;
  title: string;
  contentModules: ExamContentModule[];
  items: ExamPaperStaticItem[];
  fillIn: ExamPaperStaticFillIn | null;
};

/** Scoreable question row reused by submit. */
export type ScoreableExamQuestion = {
  examQuestionId: string;
  sortOrder: number;
  type: QuestionType;
  answerKeys: string;
  points: number;
  multiScoringRule: MultiScoringRule | null;
  optionKeys: string[];
  stem: string;
  knowledgePoints: string | null;
  explanation: string | null;
};

type CacheEntry = {
  staticPayload: ExamPaperStaticPayload;
  scoreableQuestions: ScoreableExamQuestion[];
};

const cache = new Map<string, CacheEntry>();

export function getCachedExamPaperStatic(
  examId: string,
): ExamPaperStaticPayload | null {
  return cache.get(examId)?.staticPayload ?? null;
}

export function getCachedScoreableQuestions(
  examId: string,
): ScoreableExamQuestion[] | null {
  return cache.get(examId)?.scoreableQuestions ?? null;
}

export function setExamPaperCache(
  examId: string,
  entry: CacheEntry,
): void {
  cache.set(examId, entry);
}

export function invalidateExamPaperCache(examId: string): void {
  cache.delete(examId);
}

export function clearExamPaperCache(): void {
  cache.clear();
}

/** For tests: whether an examId is cached. */
export function isExamPaperCached(examId: string): boolean {
  return cache.has(examId);
}

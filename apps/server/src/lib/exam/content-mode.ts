import type { ExamContentModule } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { FILL_MODULE_LABEL_ZH } from './content-labels.js';

export const examContentModuleSchema = z.enum(['OBJECTIVE', 'FILL']);

export const contentModulesSchema = z
  .array(examContentModuleSchema)
  .min(1, '至少选择一种考试内容');

export function hasContentModule(
  modules: ExamContentModule[],
  module: ExamContentModule,
): boolean {
  return modules.includes(module);
}

export function requiresObjectiveBatch(modules: ExamContentModule[]): boolean {
  return hasContentModule(modules, 'OBJECTIVE');
}

export function requiresFillInBatch(modules: ExamContentModule[]): boolean {
  return hasContentModule(modules, 'FILL');
}

/** 客观题或填空题：需在浏览器作答并计入 Submission */
export function requiresQuestionSubmission(modules: ExamContentModule[]): boolean {
  return requiresObjectiveBatch(modules) || requiresFillInBatch(modules);
}

export async function assertTeacherOwnsExamBatches(
  teacherId: string,
  input: {
    contentModules: ExamContentModule[];
    questionBatchId?: string | null;
    fillInBatchId?: string | null;
    rosterBatchId: string;
  },
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  if (requiresObjectiveBatch(input.contentModules) && !input.questionBatchId) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_QUESTION_BATCH',
      message: '请选择客观题题库批次',
    };
  }
  if (requiresFillInBatch(input.contentModules) && !input.fillInBatchId) {
    return {
      ok: false,
      status: 400,
      code: 'MISSING_FILL_IN_BATCH',
      message: `请选择${FILL_MODULE_LABEL_ZH}批次`,
    };
  }

  if (
    !requiresObjectiveBatch(input.contentModules) &&
    input.questionBatchId
  ) {
    return {
      ok: false,
      status: 400,
      code: 'UNEXPECTED_QUESTION_BATCH',
      message: '未勾选客观题时不应选择客观题批次',
    };
  }
  if (!requiresFillInBatch(input.contentModules) && input.fillInBatchId) {
    return {
      ok: false,
      status: 400,
      code: 'UNEXPECTED_FILL_IN_BATCH',
      message: `未勾选${FILL_MODULE_LABEL_ZH}时不应选择${FILL_MODULE_LABEL_ZH}批次`,
    };
  }

  const rosterBatch = await prisma.rosterImportBatch.findFirst({
    where: { id: input.rosterBatchId, teacherId },
    select: { id: true },
  });
  if (!rosterBatch) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_ROSTER_BATCH',
      message: '名单批次不存在或无权使用',
    };
  }

  if (input.questionBatchId) {
    const questionBatch = await prisma.questionImportBatch.findFirst({
      where: { id: input.questionBatchId, teacherId },
      select: { id: true },
    });
    if (!questionBatch) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_QUESTION_BATCH',
        message: '客观题批次不存在或无权使用',
      };
    }
  }

  if (input.fillInBatchId) {
    const fillInBatch = await prisma.fillInQuestionImportBatch.findFirst({
      where: { id: input.fillInBatchId, teacherId },
      select: { id: true },
    });
    if (!fillInBatch) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_FILL_IN_BATCH',
        message: `${FILL_MODULE_LABEL_ZH}批次不存在或无权使用`,
      };
    }
  }

  return { ok: true };
}

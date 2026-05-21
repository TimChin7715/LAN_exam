import type { Prisma } from '@prisma/client';

import { SubmitExamError } from './types.js';

export async function finalizePracticalSubmission(
  tx: Prisma.TransactionClient,
  input: { examId: string; rosterEntryId: string },
): Promise<void> {
  const draft = await tx.practicalAnswerDraft.findUnique({
    where: {
      examId_rosterEntryId: {
        examId: input.examId,
        rosterEntryId: input.rosterEntryId,
      },
    },
  });

  if (!draft) {
    throw new SubmitExamError(
      400,
      'PRACTICAL_ANSWER_REQUIRED',
      '请先上传操作题作答 Word 文档后再交卷。',
    );
  }

  const existing = await tx.practicalSubmission.findUnique({
    where: {
      examId_rosterEntryId: {
        examId: input.examId,
        rosterEntryId: input.rosterEntryId,
      },
    },
  });

  if (existing) {
    return;
  }

  await tx.practicalSubmission.create({
    data: {
      examId: input.examId,
      rosterEntryId: input.rosterEntryId,
      docxStorageKey: draft.docxStorageKey,
      docxFileName: draft.docxFileName,
    },
  });

  await tx.practicalAnswerDraft.delete({
    where: {
      examId_rosterEntryId: {
        examId: input.examId,
        rosterEntryId: input.rosterEntryId,
      },
    },
  });
}

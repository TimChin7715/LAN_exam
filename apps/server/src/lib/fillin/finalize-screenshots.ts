import type { Prisma } from '@prisma/client';

export async function finalizeFillInScreenshots(
  tx: Prisma.TransactionClient,
  input: {
    examId: string;
    rosterEntryId: string;
    submissionId: string;
  },
): Promise<void> {
  const drafts = await tx.fillInScreenshotDraft.findMany({
    where: {
      examId: input.examId,
      rosterEntryId: input.rosterEntryId,
    },
    orderBy: [{ examQuestionId: 'asc' }, { sortOrder: 'asc' }],
  });

  if (drafts.length === 0) return;

  await tx.fillInScreenshot.createMany({
    data: drafts.map((d) => ({
      submissionId: input.submissionId,
      examQuestionId: d.examQuestionId,
      sortOrder: d.sortOrder,
      storageKey: d.storageKey,
      mimeType: d.mimeType,
      byteSize: d.byteSize,
    })),
  });

  await tx.fillInScreenshotDraft.deleteMany({
    where: {
      examId: input.examId,
      rosterEntryId: input.rosterEntryId,
    },
  });
}

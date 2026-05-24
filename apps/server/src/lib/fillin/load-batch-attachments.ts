import type { PrismaClient } from '@prisma/client';

export type FillInBatchAttachmentRow = {
  id: string;
  fileName: string;
  storageKey: string;
  sortOrder: number;
};

export async function listFillInBatchAttachments(
  prisma: PrismaClient,
  batchId: string,
): Promise<FillInBatchAttachmentRow[]> {
  const rows = await prisma.fillInBatchAttachment.findMany({
    where: { batchId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      fileName: true,
      storageKey: true,
      sortOrder: true,
    },
  });
  if (rows.length > 0) return rows;

  const legacy = await prisma.fillInQuestionImportBatch.findUnique({
    where: { id: batchId },
    select: {
      attachmentFileName: true,
      attachmentStorageKey: true,
    },
  });
  if (
    legacy?.attachmentStorageKey &&
    legacy.attachmentFileName
  ) {
    return [
      {
        id: `legacy-${batchId}`,
        fileName: legacy.attachmentFileName,
        storageKey: legacy.attachmentStorageKey,
        sortOrder: 0,
      },
    ];
  }
  return [];
}

import type { PrismaClient } from '@prisma/client';

import type { ParsedRosterEntry } from './types.js';

export type ImportRosterInput = {
  teacherId: string;
  fileName: string;
  entries: ParsedRosterEntry[];
  skippedCount: number;
};

export type ImportRosterResult = {
  batchId: string;
  importedCount: number;
  skippedCount: number;
};

export async function importRoster(
  prisma: PrismaClient,
  input: ImportRosterInput,
): Promise<ImportRosterResult> {
  const { teacherId, fileName, entries, skippedCount } = input;

  const batch = await prisma.$transaction(
    async (tx) => {
      return tx.rosterImportBatch.create({
        data: {
          teacherId,
          fileName,
          totalRows: entries.length,
          importedCount: entries.length,
          skippedCount,
          entries: {
            create: entries.map((e) => ({
              fullName: e.fullName,
              organization: e.organization,
              nationalId: e.nationalId,
            })),
          },
        },
      });
    },
    { timeout: 30_000 },
  );

  return {
    batchId: batch.id,
    importedCount: batch.importedCount,
    skippedCount: batch.skippedCount,
  };
}

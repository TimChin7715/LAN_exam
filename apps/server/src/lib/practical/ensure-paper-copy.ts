import type { PrismaClient } from '@prisma/client';

import {
  copyStorageFile,
  examWorkPaperKey,
  storageFileExists,
} from '../storage/index.js';

export async function ensureStudentPaperCopy(
  prisma: PrismaClient,
  input: {
    examId: string;
    rosterEntryId: string;
    batchWordStorageKey: string;
  },
): Promise<string> {
  const lower = input.batchWordStorageKey.toLowerCase();
  const ext =
    lower.endsWith('.doc') && !lower.endsWith('.docx') ? 'doc' : 'docx';
  const paperKey = examWorkPaperKey(input.examId, input.rosterEntryId, ext);
  if (!(await storageFileExists(paperKey))) {
    await copyStorageFile(input.batchWordStorageKey, paperKey);
  }
  return paperKey;
}

import type { PrismaClient } from '@prisma/client';

import { spreadsheetExt } from '../upload/spreadsheet-file.js';
import { wordUploadExt } from '../upload/word-file.js';
import {
  practicalBatchSpreadsheetKey,
  practicalBatchWordKey,
  writeStorageFile,
} from '../storage/index.js';

export async function importPracticalBatch(
  prisma: PrismaClient,
  input: {
    teacherId: string;
    batchId: string;
    title: string;
    wordFileName: string;
    wordBuffer: Buffer;
    excelFileName: string;
    excelBuffer: Buffer;
  },
): Promise<{ batchId: string }> {
  const wordExt = wordUploadExt(input.wordFileName) ?? 'docx';
  const wordKey = practicalBatchWordKey(input.batchId, wordExt);
  const ext = spreadsheetExt(input.excelFileName) ?? 'xlsx';
  const excelKey = practicalBatchSpreadsheetKey(input.batchId, ext);

  await writeStorageFile(wordKey, input.wordBuffer);
  await writeStorageFile(excelKey, input.excelBuffer);

  await prisma.practicalQuestionImportBatch.create({
    data: {
      id: input.batchId,
      teacherId: input.teacherId,
      title: input.title,
      wordFileName: input.wordFileName,
      wordStorageKey: wordKey,
      excelFileName: input.excelFileName,
      excelStorageKey: excelKey,
    },
  });

  return { batchId: input.batchId };
}

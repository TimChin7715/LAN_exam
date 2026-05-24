import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { generateFillInWordPreview } from './generate-word-preview.js';
import {
  buildFillInBlanksFromAnswerSheet,
  buildStudentAnswerSheetExcel,
  parseAnswerSheetRows,
} from './parse-answer-sheet.js';
import type { RowError } from './types.js';
import type { SpreadsheetExt } from '../upload/spreadsheet-file.js';
import { spreadsheetExt } from '../upload/spreadsheet-file.js';
import type { WordUploadExt } from '../upload/word-file.js';
import {
  fillInBatchAttachmentItemKey,
  fillInBatchExcelKey,
  fillInBatchStudentExcelKey,
  fillInBatchWordKey,
  writeStorageFile,
} from '../storage/index.js';

export type FillInImportAttachmentInput = {
  fileName: string;
  buffer: Buffer;
  ext: SpreadsheetExt;
};

export type FillInImportResult =
  | {
      ok: true;
      batchId: string;
      title: string;
      importedCount: number;
      wordFileName: string;
      excelFileName: string;
      attachmentCount: number;
      attachmentFileNames: string[];
    }
  | {
      ok: false;
      errors: RowError[];
    };

export async function importFillInBatch(
  prisma: PrismaClient,
  input: {
    teacherId: string;
    batchId: string;
    title: string;
    wordFileName: string;
    wordExt: WordUploadExt;
    wordBuffer: Buffer;
    excelFileName: string;
    excelBuffer: Buffer;
    attachments?: FillInImportAttachmentInput[];
  },
): Promise<FillInImportResult> {
  const { rows, errors: parseErrors } = await parseAnswerSheetRows(input.excelBuffer);
  if (parseErrors.length > 0) {
    return { ok: false, errors: parseErrors };
  }

  const blanks = buildFillInBlanksFromAnswerSheet(rows);
  if (blanks.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, message: '答题卡中没有可导入的空位' }],
    };
  }

  const studentExcelBuffer = await buildStudentAnswerSheetExcel(blanks);
  const wordExt = input.wordExt;
  const excelExt = spreadsheetExt(input.excelFileName) ?? 'xlsx';
  const wordKey = fillInBatchWordKey(input.batchId, wordExt);
  const excelKey = fillInBatchExcelKey(
    input.batchId,
    excelExt === 'xls' ? 'xls' : 'xlsx',
  );
  const studentExcelKey = fillInBatchStudentExcelKey(input.batchId);

  await writeStorageFile(wordKey, input.wordBuffer);
  await generateFillInWordPreview(
    input.batchId,
    input.wordBuffer,
    input.wordFileName,
  );
  await writeStorageFile(excelKey, input.excelBuffer);
  await writeStorageFile(studentExcelKey, studentExcelBuffer);

  const attachments = input.attachments ?? [];
  const storedAttachments: {
    id: string;
    fileName: string;
    storageKey: string;
    sortOrder: number;
  }[] = [];

  for (let i = 0; i < attachments.length; i += 1) {
    const file = attachments[i]!;
    const id = randomUUID();
    const storageKey = fillInBatchAttachmentItemKey(input.batchId, id, file.ext);
    await writeStorageFile(storageKey, file.buffer);
    storedAttachments.push({
      id,
      fileName: file.fileName,
      storageKey,
      sortOrder: i,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.fillInQuestionImportBatch.create({
      data: {
        id: input.batchId,
        teacherId: input.teacherId,
        title: input.title,
        wordFileName: input.wordFileName,
        wordStorageKey: wordKey,
        excelFileName: input.excelFileName,
        excelStorageKey: excelKey,
        studentExcelStorageKey: studentExcelKey,
        attachmentFileName: null,
        attachmentStorageKey: null,
        importedCount: blanks.length,
      },
    });

    for (const att of storedAttachments) {
      await tx.fillInBatchAttachment.create({
        data: {
          id: att.id,
          batchId: input.batchId,
          fileName: att.fileName,
          storageKey: att.storageKey,
          sortOrder: att.sortOrder,
        },
      });
    }

    for (const blank of blanks) {
      await tx.question.create({
        data: {
          id: randomUUID(),
          fillInBatchId: input.batchId,
          type: 'FILL',
          stem: blank.stem,
          answerKeys: blank.answerKeys,
          points: blank.points,
          knowledgePoints: String(blank.questionNo),
          explanation: String(blank.blankIndex),
        },
      });
    }
  });

  return {
    ok: true,
    batchId: input.batchId,
    title: input.title,
    importedCount: blanks.length,
    wordFileName: input.wordFileName,
    excelFileName: input.excelFileName,
    attachmentCount: storedAttachments.length,
    attachmentFileNames: storedAttachments.map((a) => a.fileName),
  };
}

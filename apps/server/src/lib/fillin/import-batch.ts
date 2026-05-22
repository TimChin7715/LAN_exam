import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

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
  fillInBatchAttachmentKey,
  fillInBatchExcelKey,
  fillInBatchStudentExcelKey,
  fillInBatchWordKey,
  writeStorageFile,
} from '../storage/index.js';

export type FillInImportResult =
  | {
      ok: true;
      batchId: string;
      title: string;
      importedCount: number;
      wordFileName: string;
      excelFileName: string;
      attachmentFileName: string | null;
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
    attachment?: {
      fileName: string;
      buffer: Buffer;
      ext: SpreadsheetExt;
    };
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
  await writeStorageFile(excelKey, input.excelBuffer);
  await writeStorageFile(studentExcelKey, studentExcelBuffer);

  let attachmentFileName: string | null = null;
  let attachmentStorageKey: string | null = null;
  if (input.attachment) {
    attachmentFileName = input.attachment.fileName;
    attachmentStorageKey = fillInBatchAttachmentKey(
      input.batchId,
      input.attachment.ext,
    );
    await writeStorageFile(attachmentStorageKey, input.attachment.buffer);
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
        attachmentFileName,
        attachmentStorageKey,
        importedCount: blanks.length,
      },
    });

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
    attachmentFileName,
  };
}

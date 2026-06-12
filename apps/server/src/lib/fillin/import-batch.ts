import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { generateFillInWordPreview } from './generate-word-preview.js';
import {
  buildFillInInlinePreviewHtml,
  buildFillInBlanksFromAnswerSheet,
  buildStudentAnswerSheetExcel,
  countFillInBlankMarkers,
  parseAnswerSheetRows,
} from './parse-answer-sheet.js';
import type { RowError } from './types.js';
import type { FillInAttachmentExt } from '../upload/archive-file.js';
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
  ext: FillInAttachmentExt;
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

function validateInlineBlankMarkers(
  blanks: ReturnType<typeof buildFillInBlanksFromAnswerSheet>,
): RowError[] {
  const groups = new Map<number, typeof blanks>();
  for (const blank of blanks) {
    const list = groups.get(blank.questionNo) ?? [];
    list.push(blank);
    groups.set(blank.questionNo, list);
  }

  const errors: RowError[] = [];
  for (const [questionNo, group] of groups) {
    const stem = group.find((blank) => blank.stem.trim())?.stem.trim() ?? '';
    const markerCount = countFillInBlankMarkers(stem);
    if (markerCount !== group.length) {
      errors.push({
        row: group[0]?.rowNumber ?? 0,
        column: '题干',
        message: `第 ${questionNo} 题有 ${group.length} 个空位答案，题干中也必须写 ${group.length} 个【】。`,
      });
    }
  }
  return errors;
}

export async function importFillInBatch(
  prisma: PrismaClient,
  input: {
    teacherId: string;
    batchId: string;
    title: string;
    wordFileName?: string;
    wordExt?: WordUploadExt;
    wordBuffer?: Buffer;
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
      errors: [
        {
          row: 0,
          message:
            '答题卡中没有可导入的空位。请确认：① 工作表名为「答题卡」；② 已删除【示例】/【说明】行；③ 每行填写题号、答案与分值。',
        },
      ],
    };
  }

  const hasUploadedWord = Boolean(input.wordFileName && input.wordExt && input.wordBuffer);
  if (!hasUploadedWord && blanks.every((blank) => !blank.stem.trim())) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          column: '题干',
          message:
            '未上传 Word 时，Excel 中至少需要填写一个真实题干，用于生成考试端试卷预览。',
        },
      ],
    };
  }
  if (!hasUploadedWord) {
    const markerErrors = validateInlineBlankMarkers(blanks);
    if (markerErrors.length > 0) {
      return { ok: false, errors: markerErrors };
    }
  }

  const studentExcelBuffer = await buildStudentAnswerSheetExcel(blanks);
  const generatedHtml = hasUploadedWord ? null : buildFillInInlinePreviewHtml(blanks);
  const wordExt = hasUploadedWord ? input.wordExt! : 'html';
  const wordFileName = hasUploadedWord
    ? input.wordFileName!
    : `${input.excelFileName.replace(/\.(xlsx?|xls)$/i, '').trim() || input.title}-题目.html`;
  const wordBuffer = hasUploadedWord
    ? input.wordBuffer!
    : Buffer.from(generatedHtml!, 'utf8');
  const excelExt = spreadsheetExt(input.excelFileName) ?? 'xlsx';
  const wordKey = fillInBatchWordKey(input.batchId, wordExt);
  const excelKey = fillInBatchExcelKey(
    input.batchId,
    excelExt === 'xls' ? 'xls' : 'xlsx',
  );
  const studentExcelKey = fillInBatchStudentExcelKey(input.batchId);

  await writeStorageFile(wordKey, wordBuffer);
  await generateFillInWordPreview(
    input.batchId,
    wordBuffer,
    wordFileName,
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
        wordFileName,
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

    for (let importSortOrder = 0; importSortOrder < blanks.length; importSortOrder += 1) {
      const blank = blanks[importSortOrder]!;
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
          importSortOrder,
        },
      });
    }
  });

  return {
    ok: true,
    batchId: input.batchId,
    title: input.title,
    importedCount: blanks.length,
    wordFileName,
    excelFileName: input.excelFileName,
    attachmentCount: storedAttachments.length,
    attachmentFileNames: storedAttachments.map((a) => a.fileName),
  };
}

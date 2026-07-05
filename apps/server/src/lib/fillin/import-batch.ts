import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { generateFillInWordPreview, readFillInPreviewBody } from './generate-word-preview.js';
import {
  parseWordFillDocument,
  previewHtmlLeaksFilledAnswers,
} from './parse-word-fill.js';
import { sanitizeStudentWord } from './sanitize-student-word.js';
import type { RowError } from './types.js';
import type { FillInAttachmentExt } from '../upload/archive-file.js';
import type { WordUploadExt } from '../upload/word-file.js';
import {
  fillInBatchAttachmentItemKey,
  fillInBatchSourceWordKey,
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
    attachments?: FillInImportAttachmentInput[];
  },
): Promise<FillInImportResult> {
  const { blanks, errors: parseErrors } = await parseWordFillDocument(
    input.wordBuffer,
    input.wordFileName,
  );
  if (parseErrors.length > 0) {
    return { ok: false, errors: parseErrors };
  }

  if (blanks.length === 0) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message:
            'Word 中没有可导入的空位。请确认每空使用【答案】（分值）格式，例如【北京|北平】（2分）；并删除【示例】/【说明】行。',
        },
      ],
    };
  }

  const sourceWordKey = fillInBatchSourceWordKey(input.batchId, input.wordExt);
  const paperBuffer = await sanitizeStudentWord(input.wordBuffer, input.wordExt);
  const paperKey = fillInBatchWordKey(input.batchId, input.wordExt);

  await writeStorageFile(sourceWordKey, input.wordBuffer);
  await writeStorageFile(paperKey, paperBuffer);

  const previewMeta = await generateFillInWordPreview(
    input.batchId,
    paperBuffer,
    input.wordFileName,
    blanks,
  );

  if (input.wordExt === 'docx') {
    const previewBody = await readFillInPreviewBody(input.batchId);
    const inputCount = (previewBody.match(/fillin-inline-input/g) ?? []).length;
    if (inputCount !== blanks.length) {
      return {
        ok: false,
        errors: [
          {
            row: 0,
            message: `Word 预览中注入 ${inputCount} 个作答框，与导入的 ${blanks.length} 个空位不一致。请检查空位格式是否为【答案】（分值），并避免将空位拆到复杂表格结构中；若第 1 题被 Word 自动编号，请改用「第1题、」或重新导入未编辑过的试卷。`,
          },
        ],
      };
    }
    if (previewHtmlLeaksFilledAnswers(previewBody)) {
      return {
        ok: false,
        errors: [
          {
            row: 0,
            message:
              'Word 预览中仍显示标准答案。请勿在题目中插入无关图片或破坏题号格式；请重新下载模板填写后导入，或删除 Word 自动编号后再试。',
          },
        ],
      };
    }
  }

  void previewMeta;

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

  const studentWordFileName = input.wordFileName;

  await prisma.$transaction(async (tx) => {
    // Prisma client types refresh after `pnpm db:migrate` (20260703120000_fillin_word_only).
    await tx.fillInQuestionImportBatch.create({
      data: {
        id: input.batchId,
        teacherId: input.teacherId,
        title: input.title,
        wordFileName: studentWordFileName,
        wordStorageKey: paperKey,
        sourceWordStorageKey: sourceWordKey,
        excelFileName: null,
        excelStorageKey: null,
        studentExcelStorageKey: null,
        attachmentFileName: null,
        attachmentStorageKey: null,
        importedCount: blanks.length,
      } as Parameters<typeof tx.fillInQuestionImportBatch.create>[0]['data'],
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
    wordFileName: studentWordFileName,
    attachmentCount: storedAttachments.length,
    attachmentFileNames: storedAttachments.map((a) => a.fileName),
  };
}

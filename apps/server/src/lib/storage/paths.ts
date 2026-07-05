import path from 'node:path';

export function getDataDir(): string {
  const raw = process.env.DATA_DIR?.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  return path.resolve(process.cwd(), 'data');
}

export type FillInScreenshotExt = 'png' | 'jpg' | 'webp';

export function examWorkFillInScreenshotKey(
  examId: string,
  rosterEntryId: string,
  examQuestionId: string,
  screenshotId: string,
  ext: FillInScreenshotExt,
): string {
  return `exam-work/${examId}/${rosterEntryId}/fill-in/${examQuestionId}/${screenshotId}.${ext}`;
}

export function fillInBatchWordKey(
  batchId: string,
  ext: 'doc' | 'docx' | 'html' = 'docx',
): string {
  return `fill-in-batches/${batchId}/paper.${ext}`;
}

/** 考官原卷（含标准答案），不对外下发 */
export function fillInBatchSourceWordKey(
  batchId: string,
  ext: 'doc' | 'docx' = 'docx',
): string {
  return `fill-in-batches/${batchId}/source.${ext}`;
}

export function fillInBatchPreviewMetaKey(batchId: string): string {
  return `fill-in-batches/${batchId}/preview/meta.json`;
}

export function fillInBatchPreviewBodyKey(batchId: string): string {
  return `fill-in-batches/${batchId}/preview/body.html`;
}

export function fillInBatchPreviewImageKey(
  batchId: string,
  fileName: string,
): string {
  return `fill-in-batches/${batchId}/preview/images/${fileName}`;
}

export function fillInBatchPreviewImagesPrefix(batchId: string): string {
  return `fill-in-batches/${batchId}/preview/images`;
}

export function fillInBatchExcelKey(
  batchId: string,
  ext: 'xls' | 'xlsx' = 'xlsx',
): string {
  return `fill-in-batches/${batchId}/source.${ext}`;
}

export function fillInBatchStudentExcelKey(batchId: string): string {
  return `fill-in-batches/${batchId}/student-sheet.xlsx`;
}

/** @deprecated 旧版单附件路径；新导入使用 fillInBatchAttachmentItemKey */
export function fillInBatchAttachmentKey(
  batchId: string,
  ext: 'xls' | 'xlsx' | 'csv',
): string {
  return `fill-in-batches/${batchId}/attachment.${ext}`;
}

export function fillInBatchAttachmentItemKey(
  batchId: string,
  attachmentId: string,
  ext: string,
): string {
  return `fill-in-batches/${batchId}/attachments/${attachmentId}.${ext}`;
}

export function resolveStoragePath(storageKey: string): string {
  const base = getDataDir();
  const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(base, normalized);
  const resolvedBase = path.resolve(base);
  const resolvedFull = path.resolve(full);
  if (
    !resolvedFull.startsWith(resolvedBase + path.sep) &&
    resolvedFull !== resolvedBase
  ) {
    throw new Error('Invalid storage key');
  }
  return resolvedFull;
}

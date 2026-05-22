import path from 'node:path';

export function getDataDir(): string {
  const raw = process.env.DATA_DIR?.trim();
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  return path.resolve(process.cwd(), 'data');
}

export function practicalBatchWordKey(
  batchId: string,
  ext: 'doc' | 'docx' = 'docx',
): string {
  return `practical-batches/${batchId}/paper.${ext}`;
}

export function practicalBatchSpreadsheetKey(
  batchId: string,
  ext: 'xls' | 'xlsx' | 'csv',
): string {
  return `practical-batches/${batchId}/attachment.${ext}`;
}

/** @deprecated use practicalBatchSpreadsheetKey */
export function practicalBatchExcelKey(batchId: string): string {
  return practicalBatchSpreadsheetKey(batchId, 'xlsx');
}

export function examWorkPaperKey(
  examId: string,
  rosterEntryId: string,
  ext: 'doc' | 'docx' = 'docx',
): string {
  return `exam-work/${examId}/${rosterEntryId}/paper.${ext}`;
}

export function examWorkAnswerKey(
  examId: string,
  rosterEntryId: string,
  ext: 'doc' | 'docx' = 'docx',
): string {
  return `exam-work/${examId}/${rosterEntryId}/answer.${ext}`;
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
  ext: 'doc' | 'docx' = 'docx',
): string {
  return `fill-in-batches/${batchId}/paper.${ext}`;
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

export function fillInBatchAttachmentKey(
  batchId: string,
  ext: 'xls' | 'xlsx' | 'csv',
): string {
  return `fill-in-batches/${batchId}/attachment.${ext}`;
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

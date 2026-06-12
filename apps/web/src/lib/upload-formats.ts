export const WORD_ACCEPT =
  '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const SPREADSHEET_ACCEPT =
  '.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

export const ARCHIVE_ACCEPT =
  '.zip,.rar,.7z,.tar.gz,.tgz,.gz,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed,application/x-7z-compressed,application/gzip,application/x-gzip';

export const FILLIN_ATTACHMENT_ACCEPT = `${SPREADSHEET_ACCEPT},${ARCHIVE_ACCEPT}`;

export const ANSWER_SHEET_ACCEPT =
  '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function validateWordFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return null;
  }
  return '请选择 .doc 或 .docx 格式的 Word 文件';
}

export function validateSpreadsheetFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv')
  ) {
    return null;
  }
  return '请选择 .xls、.xlsx 或 .csv 格式的表格文件';
}

export function validateArchiveFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (
    lower.endsWith('.zip') ||
    lower.endsWith('.rar') ||
    lower.endsWith('.7z') ||
    lower.endsWith('.tar.gz') ||
    lower.endsWith('.tgz') ||
    lower.endsWith('.gz')
  ) {
    return null;
  }
  return '请选择 .zip、.rar、.7z、.tar.gz、.tgz 或 .gz 格式的压缩包';
}

export function validateFillInAttachmentFile(file: File): string | null {
  if (validateSpreadsheetFile(file) === null) return null;
  if (validateArchiveFile(file) === null) return null;
  return '请选择 .xls、.xlsx、.csv 表格，或 .zip / .rar / .7z / .tar.gz / .tgz / .gz 压缩包';
}

export function validateAnswerSheetFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return null;
  }
  return '请选择 .xls 或 .xlsx 格式的 Excel 试卷与答题卡';
}

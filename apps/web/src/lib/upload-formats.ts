export const WORD_ACCEPT =
  '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const SPREADSHEET_ACCEPT =
  '.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

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

export function validateAnswerSheetFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return null;
  }
  return '请选择 .xls 或 .xlsx 格式的 Excel 答题卡';
}

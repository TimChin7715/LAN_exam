import { hasOleMagic, hasZipMagic } from './word-file.js';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';

const CSV_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

export type SpreadsheetExt = 'xls' | 'xlsx' | 'csv';

export function spreadsheetExt(filename: string | undefined): SpreadsheetExt | null {
  const lower = filename?.toLowerCase() ?? '';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

/** @deprecated use spreadsheetExt */
export function practicalSpreadsheetExt(
  filename: string | undefined,
): SpreadsheetExt | null {
  return spreadsheetExt(filename);
}

function isSpreadsheetMime(mimetype: string | undefined): boolean {
  const m = mimetype ?? '';
  return m === XLSX_MIME || m === XLS_MIME || CSV_MIMES.has(m);
}

function assertValidCsvUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
): { ok: true } | { ok: false; message: string } {
  if (!filename?.toLowerCase().endsWith('.csv')) {
    return { ok: false, message: '请上传 .csv 文件' };
  }
  if (!CSV_MIMES.has(mimetype ?? '')) {
    return { ok: false, message: '文件类型无效' };
  }
  if (buffer.length === 0) {
    return { ok: false, message: 'CSV 文件不能为空' };
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  if (sample.includes(0)) {
    return { ok: false, message: 'CSV 文件内容无效' };
  }
  return { ok: true };
}

export function assertValidSpreadsheetUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
): { ok: true; ext: SpreadsheetExt } | { ok: false; message: string } {
  const ext = spreadsheetExt(filename);
  if (!ext) {
    return { ok: false, message: '请上传 .xls、.xlsx 或 .csv 文件' };
  }
  if (!isSpreadsheetMime(mimetype)) {
    return { ok: false, message: '文件类型无效' };
  }
  if (buffer.length === 0) {
    return { ok: false, message: '表格文件不能为空' };
  }

  if (ext === 'csv') {
    const check = assertValidCsvUpload(filename, mimetype, buffer);
    if (!check.ok) return check;
    return { ok: true, ext };
  }

  if (ext === 'xlsx') {
    if (!hasZipMagic(buffer)) {
      return { ok: false, message: '文件内容不是有效的 Excel 工作簿' };
    }
    return { ok: true, ext };
  }

  if (!hasOleMagic(buffer)) {
    return { ok: false, message: '文件内容不是有效的 Excel 工作簿' };
  }
  return { ok: true, ext };
}

/** @deprecated use assertValidSpreadsheetUpload */
export function assertValidXlsxUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
): { ok: true } | { ok: false; message: string } {
  const check = assertValidSpreadsheetUpload(filename, mimetype, buffer);
  if (!check.ok) return check;
  if (check.ext !== 'xlsx') {
    return { ok: false, message: '请上传 .xlsx 文件' };
  }
  return { ok: true };
}

/** @deprecated use assertValidSpreadsheetUpload */
export function assertValidPracticalSpreadsheetUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
): { ok: true; ext: SpreadsheetExt } | { ok: false; message: string } {
  return assertValidSpreadsheetUpload(filename, mimetype, buffer);
}

export function contentTypeForSpreadsheetFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) {
    return 'text/csv; charset=utf-8';
  }
  if (lower.endsWith('.xls')) {
    return XLS_MIME;
  }
  return XLSX_MIME;
}

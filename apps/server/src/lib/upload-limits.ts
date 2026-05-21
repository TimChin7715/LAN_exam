import {
  getMaxPracticalDocxBytes,
  getMaxPracticalXlsxBytes,
} from './storage/docx-file.js';

/** Default cap for roster / question-bank .xlsx imports (no dedicated env yet). */
const DEFAULT_IMPORT_XLSX_BYTES = 10 * 1024 * 1024;

/**
 * Per-file limit for multipart (busboy). Default is ~1MB if unset — too small for
 * practical Word uploads. Align with MAX_PRACTICAL_* or MULTIPART_MAX_FILE_BYTES.
 */
export function getMultipartMaxFileSizeBytes(): number {
  const override = Number(process.env.MULTIPART_MAX_FILE_BYTES);
  if (Number.isFinite(override) && override > 0) {
    return override;
  }
  return Math.max(
    getMaxPracticalDocxBytes(),
    getMaxPracticalXlsxBytes(),
    DEFAULT_IMPORT_XLSX_BYTES,
  );
}

export function getMultipartPluginLimits(): {
  files: number;
  fileSize: number;
  fields: number;
  fieldSize: number;
} {
  return {
    files: 5,
    fileSize: getMultipartMaxFileSizeBytes(),
    fields: 20,
    fieldSize: 1024 * 1024,
  };
}

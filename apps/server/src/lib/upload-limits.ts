import {
  MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES,
  MAX_FILLIN_BATCH_ATTACHMENTS,
} from './fillin/attachment-limits.js';
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
    MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES,
  );
}

export function getMultipartPluginLimits(): {
  files: number;
  fileSize: number;
  fields: number;
  fieldSize: number;
} {
  return {
    files: Math.max(5, MAX_FILLIN_BATCH_ATTACHMENTS + 2),
    fileSize: getMultipartMaxFileSizeBytes(),
    fields: 20,
    fieldSize: 1024 * 1024,
  };
}

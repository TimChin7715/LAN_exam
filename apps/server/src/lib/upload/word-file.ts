const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);

export type WordUploadExt = 'doc' | 'docx';

export function wordUploadExt(filename: string | undefined): WordUploadExt | null {
  const lower = filename?.toLowerCase() ?? '';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.doc')) return 'doc';
  return null;
}

export function isWordMime(mimetype: string | undefined): boolean {
  const m = mimetype ?? '';
  return (
    m === DOCX_MIME ||
    m === DOC_MIME ||
    m === 'application/octet-stream'
  );
}

export function hasZipMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_MAGIC);
}

export function hasOleMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(OLE_MAGIC);
}

/** Detect real format from file header (extension may be wrong). */
export function detectWordFormat(buffer: Buffer): WordUploadExt | null {
  if (hasZipMagic(buffer)) return 'docx';
  if (hasOleMagic(buffer)) return 'doc';
  return null;
}

export function assertValidWordUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
  maxBytes: number,
): { ok: true; ext: WordUploadExt } | { ok: false; message: string } {
  const extFromName = wordUploadExt(filename);
  if (!extFromName) {
    return { ok: false, message: '请上传 .doc 或 .docx 文件' };
  }
  if (!isWordMime(mimetype)) {
    return { ok: false, message: '文件类型无效' };
  }
  if (buffer.length === 0) {
    return { ok: false, message: 'Word 文件不能为空' };
  }
  if (buffer.length > maxBytes) {
    return {
      ok: false,
      message: `Word 文件不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`,
    };
  }

  const actualExt = detectWordFormat(buffer);
  if (!actualExt) {
    return {
      ok: false,
      message:
        '文件内容不是有效的 Word 文档，请用 Word/WPS 另存为 .docx 或 Word 97-2003 .doc 后重试',
    };
  }

  if (extFromName === 'doc' && actualExt === 'docx') {
    return {
      ok: false,
      message:
        '该文件实际为 .docx 格式，请将扩展名改为 .docx 后上传（.docx 才支持考试端预览图片）',
    };
  }

  return { ok: true, ext: actualExt };
}

/** @deprecated use assertValidWordUpload */
export function assertValidDocxUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
  maxBytes: number,
): { ok: true } | { ok: false; message: string } {
  const check = assertValidWordUpload(filename, mimetype, buffer, maxBytes);
  if (!check.ok) return check;
  return { ok: true };
}

export function isDocxExtension(filename: string | undefined): boolean {
  return wordUploadExt(filename) === 'docx';
}

export function contentTypeForWordFilename(filename: string): string {
  return filename.toLowerCase().endsWith('.doc')
    ? DOC_MIME
    : DOCX_MIME;
}

export function getMaxWordUploadBytes(): number {
  const n = Number(process.env.MAX_PRACTICAL_DOCX_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 20 * 1024 * 1024;
}

/** @deprecated use getMaxWordUploadBytes */
export function getMaxPracticalDocxBytes(): number {
  return getMaxWordUploadBytes();
}

export function getMaxPracticalXlsxBytes(): number {
  const n = Number(process.env.MAX_PRACTICAL_XLSX_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 10 * 1024 * 1024;
}

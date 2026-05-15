const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function isXlsxMime(mimetype: string | undefined): boolean {
  return mimetype === XLSX_MIME || mimetype === 'application/octet-stream';
}

export function isXlsxExtension(filename: string | undefined): boolean {
  return filename?.toLowerCase().endsWith('.xlsx') ?? false;
}

export function hasZipMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_MAGIC)
  );
}

export function assertValidXlsxUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
): { ok: true } | { ok: false; message: string } {
  if (!isXlsxExtension(filename)) {
    return { ok: false, message: '请上传 .xlsx 文件' };
  }
  if (!isXlsxMime(mimetype)) {
    return { ok: false, message: '文件类型无效' };
  }
  if (!hasZipMagic(buffer)) {
    return { ok: false, message: '文件内容不是有效的 Excel 工作簿' };
  }
  return { ok: true };
}

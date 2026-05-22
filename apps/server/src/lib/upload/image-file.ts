const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]);
const WEBP_MAGIC = Buffer.from([0x57, 0x45, 0x42, 0x50]);

export type ImageUploadExt = 'png' | 'jpg' | 'webp';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export const MAX_FILLIN_SCREENSHOTS_PER_BLANK = 5;

export function getMaxFillInScreenshotBytes(): number {
  const n = Number(process.env.MAX_FILLIN_SCREENSHOT_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
}

export function imageUploadExt(
  filename: string | undefined,
): ImageUploadExt | null {
  const lower = filename?.toLowerCase() ?? '';
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
  if (lower.endsWith('.webp')) return 'webp';
  return null;
}

export function isImageMime(mimetype: string | undefined): boolean {
  const m = mimetype ?? '';
  return (
    m === 'image/png' ||
    m === 'image/jpeg' ||
    m === 'image/webp' ||
    m === 'application/octet-stream'
  );
}

export function detectImageFormat(buffer: Buffer): ImageUploadExt | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PNG_MAGIC)) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    return 'jpg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(WEBP_RIFF) &&
    buffer.subarray(8, 12).equals(WEBP_MAGIC)
  ) {
    return 'webp';
  }
  return null;
}

export function contentTypeForImageExt(ext: ImageUploadExt): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
  }
}

export function assertValidImageUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
  maxBytes: number,
): { ok: true; ext: ImageUploadExt; mimeType: string } | { ok: false; message: string } {
  const extFromName = imageUploadExt(filename);
  if (!extFromName && !isImageMime(mimetype)) {
    return { ok: false, message: '请上传 PNG、JPEG 或 WebP 图片' };
  }
  if (!isImageMime(mimetype) && !extFromName) {
    return { ok: false, message: '文件类型无效' };
  }
  if (buffer.length === 0) {
    return { ok: false, message: '图片不能为空' };
  }
  if (buffer.length > maxBytes) {
    return {
      ok: false,
      message: `图片不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`,
    };
  }

  const actualExt = detectImageFormat(buffer);
  if (!actualExt) {
    return { ok: false, message: '文件内容不是有效的图片' };
  }

  if (extFromName && extFromName !== actualExt) {
    const label =
      actualExt === 'jpg' ? '.jpg/.jpeg' : `.${actualExt}`;
    return {
      ok: false,
      message: `该文件实际为 ${label} 格式，请使用正确扩展名后上传`,
    };
  }

  return {
    ok: true,
    ext: actualExt,
    mimeType: contentTypeForImageExt(actualExt),
  };
}

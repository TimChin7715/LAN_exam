import { hasZipMagic } from './word-file.js';
import type { SpreadsheetExt } from './spreadsheet-file.js';

const RAR_MAGIC = Buffer.from('Rar!\x1a\x07', 'ascii');
const SEVEN_Z_MAGIC = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

const ARCHIVE_MIMES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-gzip',
  'application/x-tar',
  'application/octet-stream',
]);

export type ArchiveExt = 'zip' | 'rar' | '7z' | 'gz' | 'tgz' | 'tar.gz';

export type FillInAttachmentExt = SpreadsheetExt | ArchiveExt;

export function archiveExt(filename: string | undefined): ArchiveExt | null {
  const lower = filename?.toLowerCase() ?? '';
  if (lower.endsWith('.tar.gz')) return 'tar.gz';
  if (lower.endsWith('.tgz')) return 'tgz';
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.rar')) return 'rar';
  if (lower.endsWith('.7z')) return '7z';
  if (lower.endsWith('.gz')) return 'gz';
  return null;
}

export function isArchiveExt(ext: string): ext is ArchiveExt {
  return (
    ext === 'zip' ||
    ext === 'rar' ||
    ext === '7z' ||
    ext === 'gz' ||
    ext === 'tgz' ||
    ext === 'tar.gz'
  );
}

export function isArchiveFilename(filename: string): boolean {
  return archiveExt(filename) !== null;
}

export function archiveExtFromStorageKey(storageKey: string): ArchiveExt | null {
  const base = storageKey.split('/').pop() ?? storageKey;
  return archiveExt(base);
}

function hasRarMagic(buffer: Buffer): boolean {
  if (buffer.length < RAR_MAGIC.length) return false;
  return buffer.subarray(0, RAR_MAGIC.length).equals(RAR_MAGIC);
}

function has7zMagic(buffer: Buffer): boolean {
  if (buffer.length < SEVEN_Z_MAGIC.length) return false;
  return buffer.subarray(0, SEVEN_Z_MAGIC.length).equals(SEVEN_Z_MAGIC);
}

function hasGzipMagic(buffer: Buffer): boolean {
  if (buffer.length < GZIP_MAGIC.length) return false;
  return buffer.subarray(0, GZIP_MAGIC.length).equals(GZIP_MAGIC);
}

function assertMagicForExt(
  ext: ArchiveExt,
  buffer: Buffer,
): { ok: true } | { ok: false; message: string } {
  switch (ext) {
    case 'zip':
      if (!hasZipMagic(buffer)) {
        return { ok: false, message: '文件内容不是有效的 ZIP 压缩包' };
      }
      return { ok: true };
    case 'rar':
      if (!hasRarMagic(buffer)) {
        return { ok: false, message: '文件内容不是有效的 RAR 压缩包' };
      }
      return { ok: true };
    case '7z':
      if (!has7zMagic(buffer)) {
        return { ok: false, message: '文件内容不是有效的 7z 压缩包' };
      }
      return { ok: true };
    case 'gz':
    case 'tgz':
    case 'tar.gz':
      if (!hasGzipMagic(buffer)) {
        return { ok: false, message: '文件内容不是有效的 gzip 压缩包' };
      }
      return { ok: true };
    default:
      return { ok: false, message: '不支持的压缩包格式' };
  }
}

export function assertValidArchiveUpload(
  filename: string | undefined,
  mimetype: string | undefined,
  buffer: Buffer,
): { ok: true; ext: ArchiveExt } | { ok: false; message: string } {
  const ext = archiveExt(filename);
  if (!ext) {
    return {
      ok: false,
      message:
        '请上传 .zip、.rar、.7z、.tar.gz、.tgz 或 .gz 格式的压缩包',
    };
  }
  if (!ARCHIVE_MIMES.has(mimetype ?? '')) {
    return { ok: false, message: '文件类型无效' };
  }
  if (buffer.length === 0) {
    return { ok: false, message: '压缩包不能为空' };
  }
  const magic = assertMagicForExt(ext, buffer);
  if (!magic.ok) return magic;
  return { ok: true, ext };
}

export function contentTypeForArchiveFilename(filename: string): string {
  const ext = archiveExt(filename);
  switch (ext) {
    case 'zip':
      return 'application/zip';
    case 'rar':
      return 'application/vnd.rar';
    case '7z':
      return 'application/x-7z-compressed';
    case 'gz':
    case 'tgz':
    case 'tar.gz':
      return 'application/gzip';
    default:
      return 'application/octet-stream';
  }
}

export const FILLIN_ATTACHMENT_FORMAT_HINT =
  '请上传 .xls、.xlsx、.csv 或压缩包（.zip / .rar / .7z / .tar.gz / .tgz / .gz）';

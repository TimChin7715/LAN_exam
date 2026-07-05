import { createHash } from 'node:crypto';

import JSZip from 'jszip';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

import { injectWordPreviewInputs } from './inject-word-preview-inputs.js';
import type { ParsedFillInBlank } from './types.js';
import { detectWordFormat, wordUploadExt } from '../upload/word-file.js';
import {
  deleteStorageTree,
  fillInBatchPreviewBodyKey,
  fillInBatchPreviewImageKey,
  fillInBatchPreviewImagesPrefix,
  fillInBatchPreviewMetaKey,
  readStorageFile,
  storageFileExists,
  writeStorageFile,
} from '../storage/index.js';

/** Placeholder in stored HTML; rewritten per exam when served. */
export const FILLIN_PREVIEW_ASSET_PREFIX = '@@FILLIN_ASSET@@/';

/** Bump when preview HTML/image pipeline changes to invalidate stored previews. */
export const FILLIN_PREVIEW_PIPELINE_VERSION = 6;

export type FillInPreviewMeta = {
  version: string;
  generatedAt: string;
  pipelineVersion?: number;
};

const generatingByBatch = new Map<string, Promise<FillInPreviewMeta>>();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function previewVersionFromWordBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

/** Version key for preview meta, ETag, and asset URLs (word hash + pipeline). */
export function buildFillInPreviewVersion(wordBuffer: Buffer): string {
  return `${previewVersionFromWordBuffer(wordBuffer)}.p${FILLIN_PREVIEW_PIPELINE_VERSION}`;
}

export function previewHtmlHasImages(html: string): boolean {
  return /<img[\s>]/i.test(html) || html.includes(FILLIN_PREVIEW_ASSET_PREFIX);
}

export async function docxHasEmbeddedImages(buffer: Buffer): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    return Object.keys(zip.files).some(
      (name) => name.startsWith('word/media/') && !name.endsWith('/'),
    );
  } catch {
    return false;
  }
}

function previewMetaMatchesWord(
  meta: FillInPreviewMeta,
  expectedVersion: string,
): boolean {
  return (
    meta.version === expectedVersion &&
    (meta.pipelineVersion ?? 0) === FILLIN_PREVIEW_PIPELINE_VERSION
  );
}

function isHtmlPreviewFilename(filename: string | undefined): boolean {
  return filename?.toLowerCase().endsWith('.html') ?? false;
}

function imageExtFromContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'png';
}

function contentTypeForPreviewImage(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

export function isValidFillInPreviewImageName(name: string): boolean {
  return /^\d+\.(png|jpe?g|webp|gif)$/i.test(name);
}

export function rewriteFillInPreviewAssetUrls(
  html: string,
  examId: string,
  version: string,
): string {
  const base = `/api/student/exam/fillin/word/preview/asset?examId=${encodeURIComponent(examId)}&v=${encodeURIComponent(version)}&name=`;
  return html.split(FILLIN_PREVIEW_ASSET_PREFIX).join(base);
}

async function buildDocxPreviewHtml(
  batchId: string,
  buffer: Buffer,
  blanks?: ParsedFillInBlank[],
): Promise<string> {
  let imageIndex = 0;
  const { value } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const idx = imageIndex++;
        const ext = imageExtFromContentType(image.contentType);
        const fileName = `${idx}.${ext}`;
        const imageBuffer = Buffer.from(
          await image.readAsBase64String(),
          'base64',
        );
        await writeStorageFile(
          fillInBatchPreviewImageKey(batchId, fileName),
          imageBuffer,
        );
        return {
          src: `${FILLIN_PREVIEW_ASSET_PREFIX}${fileName}`,
        };
      }),
    },
  );
  const html = value.trim();
  if (!html) {
    return '<p class="text-muted">试卷正文为空。</p>';
  }
  if (blanks && blanks.length > 0) {
    return injectWordPreviewInputs(html, blanks);
  }
  return html;
}

async function buildDocPreviewHtml(
  buffer: Buffer,
  blanks?: ParsedFillInBlank[],
): Promise<string> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  const text = doc.getBody().replace(/\r\n/g, '\n').trim();
  if (!text) {
    return '<p class="text-muted">试卷正文为空。</p>';
  }
  const escaped = escapeHtml(text);
  const preHtml = `<pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed">${escaped}</pre>`;
  if (blanks && blanks.length > 0) {
    return injectWordPreviewInputs(preHtml, blanks);
  }
  return preHtml;
}

/** Store already-rendered HTML preview, used by Excel-only fill-in imports. */
export async function generateFillInHtmlPreview(
  batchId: string,
  html: string,
  sourceBuffer: Buffer = Buffer.from(html, 'utf8'),
): Promise<FillInPreviewMeta> {
  const version = buildFillInPreviewVersion(sourceBuffer);
  const body = html.trim() || '<p class="text-muted">试卷正文为空。</p>';

  try {
    await deleteStorageTree(fillInBatchPreviewImagesPrefix(batchId));
  } catch {
    // ignore missing dir
  }

  const meta: FillInPreviewMeta = {
    version,
    generatedAt: new Date().toISOString(),
    pipelineVersion: FILLIN_PREVIEW_PIPELINE_VERSION,
  };

  await writeStorageFile(
    fillInBatchPreviewMetaKey(batchId),
    Buffer.from(JSON.stringify(meta), 'utf8'),
  );
  await writeStorageFile(
    fillInBatchPreviewBodyKey(batchId),
    Buffer.from(body, 'utf8'),
  );

  return meta;
}

/** Pre-render Word 试卷 to HTML + sidecar images (import-time; cheap at exam read). */
export async function generateFillInWordPreview(
  batchId: string,
  buffer: Buffer,
  filename?: string,
  blanks?: ParsedFillInBlank[],
): Promise<FillInPreviewMeta> {
  if (isHtmlPreviewFilename(filename)) {
    const html = blanks?.length
      ? injectWordPreviewInputs(buffer.toString('utf8'), blanks)
      : buffer.toString('utf8');
    return generateFillInHtmlPreview(batchId, html, buffer);
  }

  const version = buildFillInPreviewVersion(buffer);
  const ext = detectWordFormat(buffer) ?? wordUploadExt(filename) ?? 'docx';

  try {
    await deleteStorageTree(fillInBatchPreviewImagesPrefix(batchId));
  } catch {
    // ignore missing dir
  }

  const html =
    ext === 'doc'
      ? await buildDocPreviewHtml(buffer, blanks)
      : await buildDocxPreviewHtml(batchId, buffer, blanks);

  const meta: FillInPreviewMeta = {
    version,
    generatedAt: new Date().toISOString(),
    pipelineVersion: FILLIN_PREVIEW_PIPELINE_VERSION,
  };

  await writeStorageFile(
    fillInBatchPreviewMetaKey(batchId),
    Buffer.from(JSON.stringify(meta), 'utf8'),
  );
  await writeStorageFile(
    fillInBatchPreviewBodyKey(batchId),
    Buffer.from(html, 'utf8'),
  );

  return meta;
}

async function readStoredPreviewMeta(
  batchId: string,
): Promise<FillInPreviewMeta | null> {
  if (!(await storageFileExists(fillInBatchPreviewMetaKey(batchId)))) {
    return null;
  }
  const raw = await readStorageFile(fillInBatchPreviewMetaKey(batchId));
  try {
    const parsed = JSON.parse(raw.toString('utf8')) as FillInPreviewMeta;
    if (typeof parsed.version === 'string' && parsed.version.length > 0) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

/** Ensure preview exists and matches current Word file; one generate per batch at a time. */
export async function ensureFillInWordPreview(
  batchId: string,
  options: {
    /** 用于 mammoth 预览的学员卷（已抹答案）；无则回退 wordStorageKey */
    previewWordStorageKey: string;
    wordFileName: string;
    blanks: ParsedFillInBlank[];
  },
): Promise<FillInPreviewMeta> {
  const wordBuffer = await readStorageFile(options.previewWordStorageKey);
  const expectedVersion = buildFillInPreviewVersion(wordBuffer);
  const ext = detectWordFormat(wordBuffer) ?? wordUploadExt(options.wordFileName) ?? 'docx';
  const existing = await readStoredPreviewMeta(batchId);
  if (existing && previewMetaMatchesWord(existing, expectedVersion)) {
    const body = await readFillInPreviewBody(batchId);
    if (body.includes('fillin-inline-input')) {
      if (ext === 'docx') {
        const hasMedia = await docxHasEmbeddedImages(wordBuffer);
        const hasImgInPreview = previewHtmlHasImages(body);
        if (!hasMedia || hasImgInPreview) {
          return existing;
        }
      } else {
        return existing;
      }
    }
  }

  let pending = generatingByBatch.get(batchId);
  if (!pending) {
    pending = generateFillInWordPreview(
      batchId,
      wordBuffer,
      options.wordFileName,
      options.blanks,
    );
    generatingByBatch.set(batchId, pending);
    pending.finally(() => {
      if (generatingByBatch.get(batchId) === pending) {
        generatingByBatch.delete(batchId);
      }
    });
  }
  return pending;
}

export async function readFillInPreviewBody(batchId: string): Promise<string> {
  const raw = await readStorageFile(fillInBatchPreviewBodyKey(batchId));
  return raw.toString('utf8');
}

export { contentTypeForPreviewImage };

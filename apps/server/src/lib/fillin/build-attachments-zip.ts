import archiver from 'archiver';
import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';

import { FILL_MODULE_LABEL_ZH } from '../exam/content-labels.js';
import { dedupeZipEntryNames } from './dedupe-zip-entry-names.js';
import type { FillInBatchAttachmentRow } from './load-batch-attachments.js';
import {
  archiveExtFromStorageKey,
  contentTypeForArchiveFilename,
  isArchiveFilename,
} from '../upload/archive-file.js';
import { readStorageFile } from '../storage/index.js';

export { contentTypeForArchiveFilename };

export type FillInAttachmentZipEntry = {
  fileName: string;
  storageKey: string;
};

export async function streamFillInAttachmentsZip(
  entries: FillInAttachmentZipEntry[],
): Promise<Readable> {
  const out = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => out.destroy(err));
  archive.pipe(out);

  const zipNames = dedupeZipEntryNames(entries.map((e) => e.fileName));
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    const buffer = await readStorageFile(entry.storageKey);
    archive.append(buffer, { name: zipNames[i]! });
  }

  void archive.finalize();
  return out;
}

export function safeFillInAttachmentsZipFilename(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]/g, '_').trim() || FILL_MODULE_LABEL_ZH;
  return `${base}-附件.zip`;
}

/** 仅一个压缩包附件时学员端直接下载该文件（不套外层 ZIP）。 */
export function getSingleStoredArchiveAttachment(
  attachments: FillInBatchAttachmentRow[],
): FillInBatchAttachmentRow | null {
  if (attachments.length !== 1) return null;
  const only = attachments[0]!;
  if (isArchiveFilename(only.fileName)) return only;
  if (archiveExtFromStorageKey(only.storageKey)) return only;
  return null;
}

export function resolveFillInAttachmentDownloadFilename(
  attachments: FillInBatchAttachmentRow[],
  batchTitle: string,
): string | null {
  if (attachments.length === 0) return null;
  const singleArchive = getSingleStoredArchiveAttachment(attachments);
  if (singleArchive) return singleArchive.fileName;
  return safeFillInAttachmentsZipFilename(batchTitle);
}

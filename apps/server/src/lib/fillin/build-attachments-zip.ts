import archiver from 'archiver';
import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';

import { dedupeZipEntryNames } from './dedupe-zip-entry-names.js';
import { readStorageFile } from '../storage/index.js';

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
  const base = title.replace(/[\\/:*?"<>|]/g, '_').trim() || '填空题';
  return `${base}-附件.zip`;
}

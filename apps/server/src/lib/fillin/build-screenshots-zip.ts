import archiver from 'archiver';
import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';

import {
  fillInScreenshotExportBasename,
  fillInScreenshotExportExt,
  fillInScreenshotStudentFolderName,
} from './screenshot-export-name.js';
import { readStorageFile } from '../storage/index.js';

export type FillInScreenshotZipEntry = {
  fullName: string;
  nationalId: string;
  questionNo: string;
  sortOrder: number;
  storageKey: string;
  mimeType: string;
};

export function groupScreenshotsForExport(
  rows: FillInScreenshotZipEntry[],
): Map<string, FillInScreenshotZipEntry[]> {
  const byStudent = new Map<string, FillInScreenshotZipEntry[]>();
  for (const row of rows) {
    const folder = fillInScreenshotStudentFolderName(
      row.fullName,
      row.nationalId,
    );
    const list = byStudent.get(folder) ?? [];
    list.push(row);
    byStudent.set(folder, list);
  }
  return byStudent;
}

export async function streamFillInScreenshotsZip(
  rows: FillInScreenshotZipEntry[],
): Promise<Readable> {
  const out = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err) => out.destroy(err));
  archive.pipe(out);

  const byStudent = groupScreenshotsForExport(rows);

  for (const [folder, studentRows] of byStudent) {
    const byQuestion = new Map<string, FillInScreenshotZipEntry[]>();
    for (const row of studentRows) {
      const key = row.questionNo;
      const list = byQuestion.get(key) ?? [];
      list.push(row);
      byQuestion.set(key, list);
    }

    for (const [, questionRows] of byQuestion) {
      const sorted = [...questionRows].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      const total = sorted.length;
      for (let i = 0; i < sorted.length; i++) {
        const row = sorted[i]!;
        const index = total <= 1 ? 1 : i + 1;
        const base = fillInScreenshotExportBasename(
          row.questionNo,
          index,
          total,
        );
        const ext = fillInScreenshotExportExt(row.mimeType);
        const zipPath = `${folder}/${base}.${ext}`;
        const buffer = await readStorageFile(row.storageKey);
        archive.append(buffer, { name: zipPath });
      }
    }
  }

  void archive.finalize();
  return out;
}

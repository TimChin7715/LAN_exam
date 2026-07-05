import type { PrismaClient } from '@prisma/client';

import {
  ensureFillInWordPreview,
  readFillInPreviewBody,
  rewriteFillInPreviewAssetUrls,
} from './generate-word-preview.js';
import { loadFillInBlanksForBatch } from './load-fillin-blanks-from-batch.js';

export type FillInPreviewBatchSource = {
  id: string;
  wordFileName: string;
  wordStorageKey: string;
  sourceWordStorageKey: string | null;
};

/** Cached HTML for student preview (generated at import; lazy backfill if missing). */
export async function loadFillInWordPreviewHtml(
  prisma: PrismaClient,
  input: {
    batch: FillInPreviewBatchSource;
    examId: string;
  },
): Promise<{ html: string; version: string }> {
  const blanks = await loadFillInBlanksForBatch(prisma, input.batch.id);
  const previewWordStorageKey = input.batch.wordStorageKey;

  const meta = await ensureFillInWordPreview(input.batch.id, {
    previewWordStorageKey,
    wordFileName: input.batch.wordFileName,
    blanks,
  });
  const body = await readFillInPreviewBody(input.batch.id);
  return {
    html: rewriteFillInPreviewAssetUrls(body, input.examId, meta.version),
    version: meta.version,
  };
}

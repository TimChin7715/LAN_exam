import {
  ensureFillInWordPreview,
  readFillInPreviewBody,
  rewriteFillInPreviewAssetUrls,
} from './generate-word-preview.js';

/** Cached HTML for student preview (generated at import; lazy backfill if missing). */
export async function loadFillInWordPreviewHtml(input: {
  batchId: string;
  wordStorageKey: string;
  wordFileName: string;
  examId: string;
}): Promise<{ html: string; version: string }> {
  const meta = await ensureFillInWordPreview(
    input.batchId,
    input.wordStorageKey,
    input.wordFileName,
  );
  const body = await readFillInPreviewBody(input.batchId);
  return {
    html: rewriteFillInPreviewAssetUrls(body, input.examId, meta.version),
    version: meta.version,
  };
}

export const MAX_FILLIN_BATCH_ATTACHMENTS = 10;

/** 同一填空题批次附件合计上限（字节） */
export const MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES = 1024 * 1024 * 1024;

export const MAX_FILLIN_ATTACHMENTS_TOTAL_LABEL = '1GB';

export function assertFillInAttachmentsWithinLimits(
  files: { buffer: Buffer }[],
): { ok: true } | { ok: false; message: string } {
  if (files.length > MAX_FILLIN_BATCH_ATTACHMENTS) {
    return {
      ok: false,
      message: `最多上传 ${MAX_FILLIN_BATCH_ATTACHMENTS} 个附件`,
    };
  }
  const totalBytes = files.reduce((sum, f) => sum + f.buffer.length, 0);
  if (totalBytes > MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES) {
    return {
      ok: false,
      message: `附件总大小不能超过 ${MAX_FILLIN_ATTACHMENTS_TOTAL_LABEL}`,
    };
  }
  return { ok: true };
}

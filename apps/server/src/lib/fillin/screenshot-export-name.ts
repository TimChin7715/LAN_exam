/** 导出 ZIP 内文件名（不含扩展名）：1 张 → 第x题；多张 → 第x题1、第x题2… */
export function fillInScreenshotExportBasename(
  questionNo: string,
  index: number,
  total: number,
): string {
  const q = questionNo.trim() || '0';
  if (total <= 1) return `第${q}题`;
  return `第${q}题${index}`;
}

export function fillInScreenshotExportExt(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

/** 学员文件夹名：姓名 + 身份证后 4 位 */
export function fillInScreenshotStudentFolderName(
  fullName: string,
  nationalId: string,
): string {
  const safeName = fullName.replace(/[\\/:*?"<>|]/g, '_').trim() || '学员';
  const tail = nationalId.replace(/\s/g, '').slice(-4) || '0000';
  return `${safeName}_${tail}`;
}

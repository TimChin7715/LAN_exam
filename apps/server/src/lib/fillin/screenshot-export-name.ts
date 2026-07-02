function toChineseNumeral(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n < 10) return digits[n]!;
  if (n < 20) {
    return n === 10 ? '十' : `十${digits[n % 10]!}`;
  }
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ones === 0
      ? `${digits[tens]!}十`
      : `${digits[tens]!}十${digits[ones]!}`;
  }
  return String(n);
}

/** 导出 ZIP 内文件名（不含扩展名）：第一题01、第一题02… */
export function fillInScreenshotExportBasename(
  questionNo: string,
  index: number,
): string {
  const parsedQuestionNo = Number.parseInt(questionNo.trim(), 10);
  const q = Number.isFinite(parsedQuestionNo) ? parsedQuestionNo : 0;
  const seq = index <= 99 ? String(index).padStart(2, '0') : String(index);
  return `第${toChineseNumeral(q)}题${seq}`;
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

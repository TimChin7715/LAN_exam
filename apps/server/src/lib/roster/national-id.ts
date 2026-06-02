import { MAX_NATIONAL_ID_LENGTH } from './types.js';

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const;
const CHECK_CHARS = '10X98765432';

/** Loose roster/login ID check: non-empty after trim, max length. */
export function validateRosterNationalId(id: string): string | null {
  const trimmed = id.trim();
  if (!trimmed) {
    return '身份证号不能为空';
  }
  if (trimmed.length > MAX_NATIONAL_ID_LENGTH) {
    return `身份证号不得超过 ${MAX_NATIONAL_ID_LENGTH} 个字符`;
  }
  return null;
}

export function isValidNationalIdFormat(id: string): boolean {
  if (id.length !== 18) return false;
  const body = id.slice(0, 17);
  if (!/^\d{17}$/.test(body)) return false;
  const last = id[17];
  if (!/^[\dXx]$/.test(last)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(body[i]) * WEIGHTS[i];
  return last.toUpperCase() === CHECK_CHARS[sum % 11];
}

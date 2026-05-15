const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const;
const CHECK_CHARS = '10X98765432';

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

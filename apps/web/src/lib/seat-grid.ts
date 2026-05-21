export function computeSeatGridDimensions(count: number): {
  cols: number;
  rows: number;
} {
  if (count <= 0) {
    return { cols: 4, rows: 0 };
  }
  const cols = count <= 20 ? 4 : 7;
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

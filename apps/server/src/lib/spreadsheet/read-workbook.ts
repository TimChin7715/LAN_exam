import * as XLSX from 'xlsx';

export class SpreadsheetReadError extends Error {
  constructor(
    message: string,
    public readonly code = 'SPREADSHEET_READ_ERROR',
  ) {
    super(message);
    this.name = 'SpreadsheetReadError';
  }
}

export type LoadedSpreadsheet = {
  sheetName: string;
  /** Row 0 is the header row (1-based row number 1 in Excel). */
  rows: string[][];
};

function cellToString(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  // 优先使用 Excel 显示文本（与单元格「文本」格式下所见一致）
  if (typeof cell.w === 'string' && cell.w.trim().length > 0) {
    return cell.w.trim();
  }
  const value = cell.v;
  if (value == null) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  return String(value).trim();
}

function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      row.push(cellToString(cell));
    }
    rows.push(row);
  }
  return rows;
}

function pickSheet(
  workbook: XLSX.WorkBook,
  sheetName?: string,
): { name: string; sheet: XLSX.WorkSheet } {
  if (sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new SpreadsheetReadError(`缺少工作表「${sheetName}」`);
    }
    return { name: sheetName, sheet };
  }
  const firstName = workbook.SheetNames[0];
  if (!firstName) {
    throw new SpreadsheetReadError('工作簿中没有工作表');
  }
  const sheet = workbook.Sheets[firstName];
  if (!sheet) {
    throw new SpreadsheetReadError('无法读取工作表');
  }
  return { name: firstName, sheet };
}

export function loadSpreadsheet(
  buffer: Buffer,
  options?: { sheetName?: string },
): LoadedSpreadsheet {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      raw: false,
    });
  } catch {
    throw new SpreadsheetReadError(
      '无法解析 Excel，请另存为 .xlsx 后重试，或检查文件是否损坏',
    );
  }

  const { name, sheet } = pickSheet(workbook, options?.sheetName);
  const rows = sheetToRows(sheet);
  if (rows.length === 0) {
    throw new SpreadsheetReadError('工作表为空');
  }
  return { sheetName: name, rows };
}

export function headerIndexMap(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((name, index) => {
    const t = name.trim();
    if (t) map.set(t, index);
  });
  return map;
}

export function getCellByHeader(
  row: string[],
  headerToCol: Map<string, number>,
  header: string,
): string {
  const col = headerToCol.get(header);
  if (col === undefined) return '';
  return (row[col] ?? '').trim();
}

import ExcelJS from 'exceljs';

import {
  MAX_ROSTER_IMPORT_ROWS,
  REQUIRED_HEADERS,
  RosterTemplateError,
  SHEET_NAME,
  type RawRosterRow,
} from './types.js';

export type ParseRosterWorkbookResult = {
  rows: RawRosterRow[];
  skippedExampleCount: number;
  skippedEmptyCount: number;
};

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value == null) return '';
  if (typeof cell.value === 'object' && 'text' in cell.value) {
    return String(cell.value.text ?? '').trim();
  }
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    const rich = cell.value as ExcelJS.CellRichTextValue;
    return rich.richText.map((p) => p.text).join('').trim();
  }
  return String(cell.value).trim();
}

function normalizeHeaderRow(row: ExcelJS.Row): Map<string, number> {
  const headerToCol = new Map<string, number>();
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const name = cellText(cell);
    if (name) headerToCol.set(name, colNumber);
  });
  return headerToCol;
}

function assertRequiredHeaders(headerToCol: Map<string, number>): void {
  for (const h of REQUIRED_HEADERS) {
    if (!headerToCol.has(h)) {
      throw new RosterTemplateError(
        'INVALID_TEMPLATE',
        `缺少必需列「${h}」`,
      );
    }
  }
}

function getCellByHeader(
  row: ExcelJS.Row,
  headerToCol: Map<string, number>,
  header: string,
): string {
  const col = headerToCol.get(header);
  if (!col) return '';
  return cellText(row.getCell(col));
}

export async function parseWorkbook(
  buffer: Buffer,
): Promise<ParseRosterWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    throw new RosterTemplateError(
      'INVALID_TEMPLATE',
      `缺少工作表「${SHEET_NAME}」`,
    );
  }

  const headerRow = sheet.getRow(1);
  const headerToCol = normalizeHeaderRow(headerRow);
  assertRequiredHeaders(headerToCol);

  const rows: RawRosterRow[] = [];
  let skippedExampleCount = 0;
  let skippedEmptyCount = 0;
  let dataRowCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const fullName = getCellByHeader(row, headerToCol, '姓名');
    const nationalId = getCellByHeader(row, headerToCol, '身份证号');

    if (!fullName && !nationalId) {
      skippedEmptyCount += 1;
      return;
    }

    if (fullName.startsWith('【示例】')) {
      skippedExampleCount += 1;
      return;
    }

    dataRowCount += 1;
    if (dataRowCount > MAX_ROSTER_IMPORT_ROWS) {
      throw new RosterTemplateError(
        'ROW_LIMIT_EXCEEDED',
        `单次导入不得超过 ${MAX_ROSTER_IMPORT_ROWS} 行`,
      );
    }

    rows.push({ rowNumber, fullName, nationalId });
  });

  return { rows, skippedExampleCount, skippedEmptyCount };
}

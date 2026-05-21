import {
  getCellByHeader,
  headerIndexMap,
  loadSpreadsheet,
} from '../spreadsheet/read-workbook.js';
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

export async function parseWorkbook(
  buffer: Buffer,
): Promise<ParseRosterWorkbookResult> {
  const { rows: allRows } = loadSpreadsheet(buffer, { sheetName: SHEET_NAME });
  const headerToCol = headerIndexMap(allRows[0] ?? []);
  assertRequiredHeaders(headerToCol);

  const rows: RawRosterRow[] = [];
  let skippedExampleCount = 0;
  let skippedEmptyCount = 0;
  let dataRowCount = 0;

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i]!;
    const rowNumber = i + 1;
    const fullName = getCellByHeader(row, headerToCol, '姓名');
    const organization = getCellByHeader(row, headerToCol, '单位');
    const nationalId = getCellByHeader(row, headerToCol, '身份证号');

    if (!fullName && !organization && !nationalId) {
      skippedEmptyCount += 1;
      continue;
    }

    if (fullName.startsWith('【示例】')) {
      skippedExampleCount += 1;
      continue;
    }

    dataRowCount += 1;
    if (dataRowCount > MAX_ROSTER_IMPORT_ROWS) {
      throw new RosterTemplateError(
        'ROW_LIMIT_EXCEEDED',
        `单次导入不得超过 ${MAX_ROSTER_IMPORT_ROWS} 行`,
      );
    }

    rows.push({ rowNumber, fullName, organization, nationalId });
  }

  return { rows, skippedExampleCount, skippedEmptyCount };
}

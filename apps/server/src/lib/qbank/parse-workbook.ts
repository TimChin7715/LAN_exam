import {
  getCellByHeader,
  headerIndexMap,
  loadSpreadsheet,
} from '../spreadsheet/read-workbook.js';
import {
  MAX_IMPORT_ROWS,
  OPTION_HEADER_PATTERN,
  QbankTemplateError,
  REQUIRED_HEADERS,
  SHEET_NAME,
  type RawRow,
} from './types.js';

const TYPE_MAP: Record<string, 'SINGLE' | 'MULTI' | 'JUDGE'> = {
  单选: 'SINGLE',
  single: 'SINGLE',
  SINGLE: 'SINGLE',
  多选: 'MULTI',
  multi: 'MULTI',
  MULTI: 'MULTI',
  判断: 'JUDGE',
  judge: 'JUDGE',
  JUDGE: 'JUDGE',
};

export type ParseWorkbookResult = {
  rows: RawRow[];
  skippedExampleCount: number;
  skippedEmptyCount: number;
};

function assertRequiredHeaders(headerToCol: Map<string, number>): void {
  for (const h of REQUIRED_HEADERS) {
    if (!headerToCol.has(h)) {
      throw new QbankTemplateError(
        'INVALID_TEMPLATE',
        `缺少必需列「${h}」`,
      );
    }
  }
}

export function mapTypeText(typeText: string): 'SINGLE' | 'MULTI' | 'JUDGE' | null {
  const key = typeText.trim();
  return TYPE_MAP[key] ?? null;
}

export { TYPE_MAP };

export async function parseWorkbook(buffer: Buffer): Promise<ParseWorkbookResult> {
  const { rows: allRows } = loadSpreadsheet(buffer, { sheetName: SHEET_NAME });
  const headerToCol = headerIndexMap(allRows[0] ?? []);
  assertRequiredHeaders(headerToCol);

  const optionHeaders: { key: string; col: number }[] = [];
  for (const [name, col] of headerToCol) {
    if (OPTION_HEADER_PATTERN.test(name)) {
      optionHeaders.push({ key: name, col });
    }
  }
  optionHeaders.sort((a, b) => a.key.localeCompare(b.key));

  const rows: RawRow[] = [];
  let skippedExampleCount = 0;
  let skippedEmptyCount = 0;
  let dataRowCount = 0;

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i]!;
    const rowNumber = i + 1;
    const stem = getCellByHeader(row, headerToCol, '题干');
    if (!stem) {
      skippedEmptyCount += 1;
      continue;
    }
    if (stem.startsWith('【示例】')) {
      skippedExampleCount += 1;
      continue;
    }

    dataRowCount += 1;
    if (dataRowCount > MAX_IMPORT_ROWS) {
      throw new QbankTemplateError(
        'ROW_LIMIT_EXCEEDED',
        `单次导入不得超过 ${MAX_IMPORT_ROWS} 行`,
      );
    }

    const options = new Map<string, string>();
    for (const { key, col } of optionHeaders) {
      const text = (row[col] ?? '').trim();
      if (text) options.set(key, text);
    }

    const typeText = getCellByHeader(row, headerToCol, '题型');
    const mappedType = mapTypeText(typeText);
    if (mappedType === 'JUDGE') {
      if (!options.has('A')) options.set('A', '正确');
      if (!options.has('B')) options.set('B', '错误');
    }

    rows.push({
      rowNumber,
      stem,
      typeText,
      answerRaw: getCellByHeader(row, headerToCol, '答案'),
      explanation: getCellByHeader(row, headerToCol, '解析') || undefined,
      knowledgePoints: getCellByHeader(row, headerToCol, '知识点') || undefined,
      difficultyRaw: getCellByHeader(row, headerToCol, '难度') || undefined,
      pointsRaw: getCellByHeader(row, headerToCol, '分值') || undefined,
      options,
    });
  }

  return { rows, skippedExampleCount, skippedEmptyCount };
}

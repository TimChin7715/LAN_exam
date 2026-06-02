import { validateRosterNationalId } from './national-id.js';
import {
  MAX_ORGANIZATION_LENGTH,
  type ParsedRosterEntry,
  type RawRosterRow,
  type RowError,
} from './types.js';

function pairKey(fullName: string, nationalId: string): string {
  return `${fullName}\0${nationalId}`;
}

function validateRow(row: RawRosterRow): {
  entry?: ParsedRosterEntry;
  errors: RowError[];
} {
  const errors: RowError[] = [];
  const fullName = row.fullName.trim();
  const organization = row.organization.trim();
  const nationalId = row.nationalId.trim();

  if (!fullName) {
    errors.push({
      row: row.rowNumber,
      column: '姓名',
      message: '姓名不能为空',
    });
  }

  if (!organization) {
    errors.push({
      row: row.rowNumber,
      column: '单位',
      message: '单位不能为空',
    });
  } else if (organization.length > MAX_ORGANIZATION_LENGTH) {
    errors.push({
      row: row.rowNumber,
      column: '单位',
      message: `单位不得超过 ${MAX_ORGANIZATION_LENGTH} 个字符`,
    });
  }

  const nationalIdError = validateRosterNationalId(nationalId);
  if (nationalIdError) {
    errors.push({
      row: row.rowNumber,
      column: '身份证号',
      message: nationalIdError,
    });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    entry: {
      rowNumber: row.rowNumber,
      fullName,
      organization,
      nationalId,
    },
    errors: [],
  };
}

export type ValidateRowsResult = {
  entries: ParsedRosterEntry[];
  errors: RowError[];
};

export async function validateRows(
  rows: RawRosterRow[],
): Promise<ValidateRowsResult> {
  const entries: ParsedRosterEntry[] = [];
  const errors: RowError[] = [];
  const seenInBatch = new Map<string, number>();

  for (const row of rows) {
    const result = validateRow(row);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
      continue;
    }
    if (!result.entry) continue;

    const key = pairKey(result.entry.fullName, result.entry.nationalId);
    const priorRow = seenInBatch.get(key);
    if (priorRow !== undefined) {
      errors.push({
        row: result.entry.rowNumber,
        column: '姓名',
        message: `与第 ${priorRow} 行重复（姓名与身份证号组合相同）`,
      });
      errors.push({
        row: priorRow,
        column: '姓名',
        message: `与第 ${result.entry.rowNumber} 行重复（姓名与身份证号组合相同）`,
      });
      continue;
    }
    seenInBatch.set(key, result.entry.rowNumber);
    entries.push(result.entry);
  }

  if (errors.length > 0 || entries.length === 0) {
    return { entries, errors };
  }

  // Duplicates are scoped per import batch (see @@unique([batchId, fullName, nationalId])).
  return { entries, errors: [] };
}

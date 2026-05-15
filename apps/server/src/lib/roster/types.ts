export type RosterErrorCode =
  | 'INVALID_TEMPLATE'
  | 'ROW_LIMIT_EXCEEDED'
  | 'VALIDATION_ERROR';

export class RosterTemplateError extends Error {
  readonly code: RosterErrorCode;

  constructor(code: RosterErrorCode, message: string) {
    super(message);
    this.name = 'RosterTemplateError';
    this.code = code;
  }
}

export type RowError = {
  row: number;
  column?: string;
  message: string;
};

export type ParsedRosterEntry = {
  rowNumber: number;
  fullName: string;
  nationalId: string;
};

export type RawRosterRow = {
  rowNumber: number;
  fullName: string;
  nationalId: string;
};

export const REQUIRED_HEADERS = ['姓名', '身份证号'] as const;

export const MAX_ROSTER_IMPORT_ROWS = 2000;

export const SHEET_NAME = '名单导入';

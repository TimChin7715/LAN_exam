import { isValidNationalIdFormat } from './national-id.js';
import { MAX_ORGANIZATION_LENGTH } from './types.js';

export type RosterEntryFieldInput = {
  fullName: string;
  organization: string;
  nationalId: string;
};

export type NormalizedRosterEntry = {
  fullName: string;
  organization: string;
  nationalId: string;
};

export type RosterEntryFieldError = {
  field: 'fullName' | 'organization' | 'nationalId';
  message: string;
};

export function validateRosterEntryFields(
  input: RosterEntryFieldInput,
): { ok: true; entry: NormalizedRosterEntry } | { ok: false; errors: RosterEntryFieldError[] } {
  const errors: RosterEntryFieldError[] = [];
  const fullName = input.fullName.trim();
  const organization = input.organization.trim();
  const nationalId = input.nationalId.trim();

  if (!fullName) {
    errors.push({ field: 'fullName', message: '姓名不能为空' });
  }

  if (!organization) {
    errors.push({ field: 'organization', message: '单位不能为空' });
  } else if (organization.length > MAX_ORGANIZATION_LENGTH) {
    errors.push({
      field: 'organization',
      message: `单位不得超过 ${MAX_ORGANIZATION_LENGTH} 个字符`,
    });
  }

  if (!nationalId) {
    errors.push({ field: 'nationalId', message: '身份证号不能为空' });
  } else if (!isValidNationalIdFormat(nationalId)) {
    errors.push({ field: 'nationalId', message: '身份证号格式不正确' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    entry: { fullName, organization, nationalId },
  };
}

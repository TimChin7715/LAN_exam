import type { PrismaClient } from '@prisma/client';

import {
  validateRosterEntryFields,
  type NormalizedRosterEntry,
} from './validate-entry.js';
import { syncAfterRosterEntryCreated } from './sync-exam-roster-side-effects.js';
import { MAX_ROSTER_IMPORT_ROWS } from './types.js';

export class RosterEntryNotFoundError extends Error {
  constructor() {
    super('ROSTER_ENTRY_NOT_FOUND');
    this.name = 'RosterEntryNotFoundError';
  }
}

export class RosterBatchNotFoundError extends Error {
  constructor() {
    super('ROSTER_BATCH_NOT_FOUND');
    this.name = 'RosterBatchNotFoundError';
  }
}

export class RosterEntryDuplicateError extends Error {
  constructor() {
    super('DUPLICATE_ENTRY');
    this.name = 'RosterEntryDuplicateError';
  }
}

export class RosterEntryHasSubmissionsError extends Error {
  constructor(public examTitles: string[]) {
    super('ENTRY_HAS_SUBMISSIONS');
    this.name = 'RosterEntryHasSubmissionsError';
  }
}

export class RosterBatchEntryLimitError extends Error {
  constructor() {
    super('BATCH_ENTRY_LIMIT');
    this.name = 'RosterBatchEntryLimitError';
  }
}

export type RosterEntryDto = {
  id: string;
  fullName: string;
  organization: string;
  nationalId: string;
  createdAt: Date;
};

function mapEntry(entry: {
  id: string;
  fullName: string;
  organization: string;
  nationalId: string;
  createdAt: Date;
}): RosterEntryDto {
  return {
    id: entry.id,
    fullName: entry.fullName,
    organization: entry.organization,
    nationalId: entry.nationalId,
    createdAt: entry.createdAt,
  };
}

export async function assertBatchOwnedByTeacher(
  prisma: PrismaClient,
  teacherId: string,
  batchId: string,
): Promise<void> {
  const batch = await prisma.rosterImportBatch.findFirst({
    where: { id: batchId, teacherId },
    select: { id: true },
  });
  if (!batch) {
    throw new RosterBatchNotFoundError();
  }
}

export async function getEntryOwnedByTeacher(
  prisma: PrismaClient,
  teacherId: string,
  entryId: string,
): Promise<{
  id: string;
  batchId: string;
  fullName: string;
  organization: string;
  nationalId: string;
  createdAt: Date;
}> {
  const entry = await prisma.rosterEntry.findFirst({
    where: { id: entryId, batch: { teacherId } },
    select: {
      id: true,
      batchId: true,
      fullName: true,
      organization: true,
      nationalId: true,
      createdAt: true,
    },
  });
  if (!entry) {
    throw new RosterEntryNotFoundError();
  }
  return entry;
}

async function findDuplicateInBatch(
  prisma: PrismaClient,
  batchId: string,
  fullName: string,
  nationalId: string,
  excludeEntryId?: string,
): Promise<boolean> {
  const existing = await prisma.rosterEntry.findFirst({
    where: {
      batchId,
      fullName,
      nationalId,
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}

export async function assertEntryMutable(
  prisma: PrismaClient,
  entryId: string,
): Promise<void> {
  const submissionExams = await prisma.submission.findMany({
    where: { rosterEntryId: entryId },
    select: { exam: { select: { title: true } } },
  });

  const titles = [...new Set(submissionExams.map((s) => s.exam.title))];

  if (titles.length > 0) {
    throw new RosterEntryHasSubmissionsError(titles);
  }
}

export async function createRosterEntry(
  prisma: PrismaClient,
  teacherId: string,
  batchId: string,
  input: NormalizedRosterEntry,
): Promise<RosterEntryDto> {
  await assertBatchOwnedByTeacher(prisma, teacherId, batchId);

  const count = await prisma.rosterEntry.count({ where: { batchId } });
  if (count >= MAX_ROSTER_IMPORT_ROWS) {
    throw new RosterBatchEntryLimitError();
  }

  if (
    await findDuplicateInBatch(
      prisma,
      batchId,
      input.fullName,
      input.nationalId,
    )
  ) {
    throw new RosterEntryDuplicateError();
  }

  const entry = await prisma.rosterEntry.create({
    data: {
      batchId,
      fullName: input.fullName,
      organization: input.organization,
      nationalId: input.nationalId,
    },
  });

  await syncAfterRosterEntryCreated(prisma, batchId);

  return mapEntry(entry);
}

export async function updateRosterEntry(
  prisma: PrismaClient,
  teacherId: string,
  entryId: string,
  input: NormalizedRosterEntry,
): Promise<RosterEntryDto> {
  const existing = await getEntryOwnedByTeacher(prisma, teacherId, entryId);
  await assertEntryMutable(prisma, entryId);

  if (
    await findDuplicateInBatch(
      prisma,
      existing.batchId,
      input.fullName,
      input.nationalId,
      entryId,
    )
  ) {
    throw new RosterEntryDuplicateError();
  }

  const entry = await prisma.rosterEntry.update({
    where: { id: entryId },
    data: {
      fullName: input.fullName,
      organization: input.organization,
      nationalId: input.nationalId,
    },
  });

  return mapEntry(entry);
}

export async function deleteRosterEntry(
  prisma: PrismaClient,
  teacherId: string,
  entryId: string,
): Promise<void> {
  await getEntryOwnedByTeacher(prisma, teacherId, entryId);
  await assertEntryMutable(prisma, entryId);
  await prisma.rosterEntry.delete({ where: { id: entryId } });
}

export function parseAndValidateEntryBody(body: unknown):
  | { ok: true; entry: NormalizedRosterEntry }
  | { ok: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: '请求体无效' };
  }
  const raw = body as Record<string, unknown>;
  const fullName = typeof raw.fullName === 'string' ? raw.fullName : '';
  const organization =
    typeof raw.organization === 'string' ? raw.organization : '';
  const nationalId = typeof raw.nationalId === 'string' ? raw.nationalId : '';

  const validated = validateRosterEntryFields({
    fullName,
    organization,
    nationalId,
  });
  if (!validated.ok) {
    return {
      ok: false,
      message: validated.errors.map((e) => e.message).join('；'),
    };
  }
  return { ok: true, entry: validated.entry };
}

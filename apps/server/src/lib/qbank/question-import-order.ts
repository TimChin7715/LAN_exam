import type { Prisma } from '@prisma/client';

/** Stable order for questions from the same import batch. */
export const questionImportOrderBy: Prisma.QuestionOrderByWithRelationInput[] = [
  { importSortOrder: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

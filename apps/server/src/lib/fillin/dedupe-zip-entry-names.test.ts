import { describe, expect, it } from 'vitest';

import { dedupeZipEntryNames } from './dedupe-zip-entry-names.js';

describe('dedupeZipEntryNames', () => {
  it('keeps unique names unchanged', () => {
    expect(dedupeZipEntryNames(['a.xlsx', 'b.csv'])).toEqual(['a.xlsx', 'b.csv']);
  });

  it('suffixes duplicate names', () => {
    expect(dedupeZipEntryNames(['data.xlsx', 'data.xlsx', 'data.xlsx'])).toEqual([
      'data.xlsx',
      'data(2).xlsx',
      'data(3).xlsx',
    ]);
  });

  it('is case-insensitive for duplicates', () => {
    expect(dedupeZipEntryNames(['A.CSV', 'a.csv'])).toEqual(['A.CSV', 'a(2).csv']);
  });
});

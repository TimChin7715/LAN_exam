# Phase 5: 导出汇总逐题得分 - Pattern Map

**Mapped:** 2026-05-17  
**Files analyzed:** 4 new/modified (+ 2 unchanged integration refs)  
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/server/src/lib/exam/export-workbook.ts` | service | file-I/O + transform | same file (Phase 4) + `submit.ts` (`examQuestion.findMany`) | exact |
| `apps/server/src/lib/exam/export-summary.ts` | utility | transform | `score-question.ts` (pure fn) + RESEARCH `perQuestionScoresForSummary` | role-match |
| `apps/server/src/lib/exam/export-workbook.test.ts` | test | transform + file-I/O | `score-question.test.ts` + `qbank/verify-parse.ts` (fixture load) | exact |
| `fixtures/export/test1-成绩导出.xlsx` | fixture | file-I/O | `docs/fixtures/import-test/*.xlsx` + `docs/templates/` | role-match |
| `apps/server/src/lib/exam/mask-national-id.ts` | utility | transform | unchanged — reuse as-is | exact |
| `apps/server/src/routes/api/admin/exams-export.ts` | route | file-I/O | same file (Phase 4) — **no change** | exact |

## Pattern Assignments

### `apps/server/src/lib/exam/export-workbook.ts` (service, file-I/O + transform)

**Analog:** `apps/server/src/lib/exam/export-workbook.ts` (extend in place) + `apps/server/src/lib/exam/submit.ts` (ExamQuestion load order)

**Imports + workbook shell** (lines 1-5, 82-93):

```typescript
import type { QuestionType } from '@prisma/client';
import ExcelJS from 'exceljs';

import { prisma } from '../prisma.js';
import { maskNationalId } from './mask-national-id.js';

const workbook = new ExcelJS.Workbook();
workbook.creator = 'LAN Exam';

const summarySheet = workbook.addWorksheet('成绩汇总');
summarySheet.columns = [
  { header: '姓名', key: 'name', width: 16 },
  { header: '身份证号', key: 'id', width: 22 },
  { header: '总分', key: 'score', width: 10 },
  { header: '是否提交', key: 'submitted', width: 12 },
  { header: '提交时间', key: 'time', width: 20 },
];
summarySheet.getRow(1).font = { bold: true };
```

**Extend:** After `exam` load, add `prisma.examQuestion.findMany({ where: { examId }, orderBy: { sortOrder: 'asc' }, select: { id: true, sortOrder: true } })`. Append dynamic columns:

```typescript
...examQuestions.map((eq) => ({
  header: `第${eq.sortOrder + 1}题`,
  key: `q_${eq.id}`,
  width: 10,
})),
```

**Roster query + unsubmitted fixed columns** (lines 46-103) — keep `orderBy: { fullName: 'asc' }`, `maskNationalId`, `'—'` for unsubmitted total:

```typescript
const rosterEntries = await prisma.rosterEntry.findMany({
  where: { batchId: exam.rosterBatchId },
  orderBy: { fullName: 'asc' },
  select: {
    id: true,
    fullName: true,
    nationalId: true,
    submissions: {
      where: { examId },
      take: 1,
      select: {
        totalScore: true,
        submittedAt: true,
        answers: {
          select: {
            pointsAwarded: true,
            examQuestion: {
              select: {
                id: true,        // ADD for pivot key
                sortOrder: true,
                // ... existing question fields for detail only
              },
            },
          },
        },
      },
    },
  },
});

// Per row — extend addRow object:
summarySheet.addRow({
  name: entry.fullName,
  id: maskNationalId(entry.nationalId),
  score: submission ? submission.totalScore : '—',
  submitted: submission ? '已提交' : '未提交',
  time: submission ? formatDateTime(submission.submittedAt) : '',
  // + q_${eq.id} per D-02/D-03/D-04
});
```

**ExamQuestion load order** — copy from `submit.ts` (lines 32-42):

```typescript
const examQuestions = await tx.examQuestion.findMany({
  where: { examId },
  orderBy: { sortOrder: 'asc' },
  // Phase 5 export: select: { id: true, sortOrder: true } only
});
```

**Detail sheet — DO NOT MODIFY** (lines 106-139) — EXPR-04 regression anchor:

```typescript
const detailSheet = workbook.addWorksheet('答题明细');
detailSheet.columns = [
  { header: '姓名', key: 'name', width: 16 },
  // ... 8 columns unchanged
];
detailSheet.getRow(1).font = { bold: true };

for (const entry of rosterEntries) {
  const submission = entry.submissions[0];
  if (!submission) continue;

  const sortedAnswers = [...submission.answers].sort(
    (a, b) => a.examQuestion.sortOrder - b.examQuestion.sortOrder,
  );

  for (const answer of sortedAnswers) {
    detailSheet.addRow({
      num: answer.examQuestion.sortOrder + 1,
      points: answer.pointsAwarded,
      // ...
    });
  }
}
```

**Pivot row fill** (new — integrate after fixed fields):

```typescript
if (!submission) {
  for (const eq of examQuestions) row[`q_${eq.id}`] = '—';
} else {
  const byQ = new Map(
    submission.answers.map((a) => [a.examQuestion.id, a.pointsAwarded]),
  );
  for (const eq of examQuestions) {
    row[`q_${eq.id}`] = byQ.get(eq.id) ?? 0;
  }
}
```

**Scale comment** (lines 26-28) — keep unchanged:

```typescript
/**
 * Builds dual-sheet exam export. v1 scale note: ~2000 roster × ~200 questions
 * is the practical upper bound before streaming/chunking is required.
 */
```

---

### `apps/server/src/lib/exam/export-summary.ts` (utility, transform) — optional

**Analog:** `apps/server/src/lib/exam/score-question.ts` (pure export) + `05-RESEARCH.md` Pattern 4

**Pure function shape** (mirror `score-question.ts` export style):

```typescript
export function perQuestionScoresForSummary(
  examQuestions: { id: string; sortOrder: number }[],
  submission:
    | { answers: { examQuestion: { id: string }; pointsAwarded: number }[] }
    | undefined,
): (number | '—')[] {
  if (!submission) return examQuestions.map(() => '—' as const);
  const byId = new Map(
    submission.answers.map((a) => [a.examQuestion.id, a.pointsAwarded]),
  );
  return examQuestions.map((eq) => byId.get(eq.id) ?? 0);
}
```

**When to split:** Only if `export-workbook.test.ts` would exceed ~150 lines; otherwise `export` the same helpers from `export-workbook.ts`.

---

### `apps/server/src/lib/exam/export-workbook.test.ts` (test, transform + file-I/O)

**Analog:** `apps/server/src/lib/exam/score-question.test.ts` (harness) + `apps/server/src/lib/qbank/verify-parse.ts` (fixture path + `readFileSync`)

**Test harness** (`score-question.test.ts` lines 1-4):

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { perQuestionScoresForSummary } from './export-summary.js'; // or export-workbook.js
```

**Inline fixtures** (`score-question.test.ts` lines 6-12):

```typescript
const examQuestions = [
  { id: 'eq1', sortOrder: 0 },
  { id: 'eq2', sortOrder: 1 },
];
```

**Cases to cover (D-08):**

| Case | Assert |
|------|--------|
| Unsubmitted | All question cells `'—'`; `submitted === '未提交'` |
| Submitted, full answers | `perQuestionScoresForSummary` matches `pointsAwarded` |
| Missing Answer row | `?? 0` → number `0`, not empty |
| Zero score | Explicit `0` in cell |
| Summary ↔ detail | After in-memory `buildExamExportWorkbook` or helper: summary col `第k题` === detail row where `题号 === k` and same `姓名`, column `得分` |

**In-memory workbook round-trip** (no Prisma):

```typescript
import ExcelJS from 'exceljs';

const wb = new ExcelJS.Workbook();
const summary = wb.addWorksheet('成绩汇总');
// ... build columns + rows via pure helpers
const buffer = await wb.xlsx.writeBuffer();
const loaded = new ExcelJS.Workbook();
await loaded.xlsx.load(buffer as unknown as ExcelJS.Buffer);
const sheet = loaded.getWorksheet('成绩汇总')!;
assert.equal(sheet.getRow(1).getCell(6).value, '第1题');
```

**Fixture smoke** (`verify-parse.ts` lines 1-13):

```typescript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixturePath = join(root, 'fixtures/export/test1-成绩导出.xlsx');

// it('matches school sample headers', async () => { ... skip if !existsSync(fixturePath) })
```

**Detail regression** — assert worksheet「答题明细」still has 8 headers; do not assert row count against DB in unit tests.

**Run command** (from `TESTING.md`):

```bash
node --import tsx --test apps/server/src/lib/exam/export-workbook.test.ts
```

---

### `fixtures/export/test1-成绩导出.xlsx` (fixture, file-I/O)

**Analog:** `docs/fixtures/import-test/题库导入-测试.xlsx` (binary fixture layout) + Phase 4 `docs/templates/` convention

**Path:** Repo root `fixtures/export/test1-成绩导出.xlsx` (per CONTEXT D-07; **not** under `docs/fixtures/`).

**Wave 0:** Commit from school sample; confirm national IDs are masked before CI. Tests: header smoke only (`姓名` … `第1题`…); skip with message if file missing until Wave 0 completes.

**Load pattern** (`parse-workbook.ts` lines 59-63):

```typescript
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
const sheet = workbook.getWorksheet('成绩汇总');
```

---

### Unchanged integration (reference only)

**`mask-national-id.ts`** (lines 1-6):

```typescript
export function maskNationalId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length !== 18) return '—';
  return `${trimmed.slice(0, 6)}********${trimmed.slice(-4)}`;
}
```

**`exams-export.ts`** (lines 16-51) — no Phase 5 changes; still `buildExamExportWorkbook` + `writeBuffer` + UTF-8 `Content-Disposition`.

---

## Shared Patterns

### ExcelJS worksheet columns + addRow
**Source:** `export-workbook.ts` (Phase 4) + `generate-roster-template.ts`  
**Apply to:** Summary sheet extension only

```typescript
summarySheet.columns = [ /* fixed 5 + dynamic N */ ];
summarySheet.getRow(1).font = { bold: true };
summarySheet.addRow({ name: '...', id: maskNationalId(...), /* all q_* keys */ });
```

**Critical:** Every `columns[].key` must appear on each `addRow` object or ExcelJS leaves cells empty (Pitfall 3 in RESEARCH).

### Question order authority
**Source:** `submit.ts` + `export-workbook.ts` detail loop  
**Apply to:** Summary headers and pivot

- N and header text: `ExamQuestion.sortOrder + 1` → `第k题`
- Column `key`: `q_${examQuestion.id}` — **not** `sortOrder` (gaps possible)
- Detail `题号` column uses same `sortOrder + 1` for D-08 cross-check

### Unsubmitted vs submitted cell semantics
**Source:** `export-workbook.ts` lines 100-102  
**Apply to:** Total + all question columns

| Field | Unsubmitted | Submitted |
|-------|-------------|-----------|
| 总分 | `'—'` | `submission.totalScore` (number) |
| 是否提交 | `'未提交'` | `'已提交'` |
| 第k题 | `'—'` (all) | `pointsAwarded` or `0` |

Do **not** use `0` or empty for unsubmitted question columns (D-03).

### Scoring data source
**Source:** `export-workbook.ts` detail `points: answer.pointsAwarded`  
**Apply to:** Summary question columns only

Read persisted `Answer.pointsAwarded`; never call `scoreQuestion` at export time.

### ID masking + logging
**Source:** `mask-national-id.ts` + Phase 4 SECURITY  
**Apply to:** All export columns; no new log statements with `nationalId`

### Pure-function unit tests (no Prisma)
**Source:** `.planning/codebase/TESTING.md`  
**Apply to:** `export-workbook.test.ts`

Extract pivot logic; mock-free tests; async `it` for `xlsx.load`/`writeBuffer`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `fixtures/export/test1-成绩导出.xlsx` | fixture | file-I/O | File not in repo yet — Wave 0 task; use `skip` in tests until present |
| Summary↔detail consistency test | test | transform | No prior export unit tests; compose from `score-question.test.ts` + in-memory ExcelJS (RESEARCH Pattern 4) |

Planner: use `05-RESEARCH.md` code examples for pivot and consistency helper if test file grows large.

---

## Metadata

**Analog search scope:** `apps/server/src/lib/exam/`, `apps/server/src/routes/api/admin/exams-export.ts`, `apps/server/scripts/`, `docs/fixtures/`, Phase 4 `04-PATTERNS.md`  
**Files scanned:** ~12 TypeScript sources + planning artifacts  
**Pattern extraction date:** 2026-05-17

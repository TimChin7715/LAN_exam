---
phase: 05-export-summary-per-question
plan: 01
subsystem: api
tags: [exceljs, export, xlsx, prisma]

requires:
  - phase: 04-exam-submit-export
    provides: buildExamExportWorkbook dual-sheet export, maskNationalId, detail sheet
provides:
  - Wide 成绩汇总 with 第1题…第N题 columns from ExamQuestion.sortOrder
  - Pure pivot helpers in export-summary.ts
  - D-08 automated summary/detail consistency tests
  - fixtures/export/test1-成绩导出.xlsx (synthetic; replace with school sample when available)
affects: [export, admin exams]

tech-stack:
  added: []
  patterns:
    - "ExamQuestion.findMany defines N and header order; row keys q_${examQuestion.id}"
    - "perQuestionScoresForSummary pure pivot; no scoreQuestion at export"

key-files:
  created:
    - apps/server/src/lib/exam/export-summary.ts
    - apps/server/src/lib/exam/export-workbook.test.ts
    - fixtures/export/test1-成绩导出.xlsx
    - apps/server/scripts/generate-export-fixture.ts
  modified:
    - apps/server/src/lib/exam/export-workbook.ts

key-decisions:
  - "Split export-summary.ts for testable pivot (RESEARCH Pattern 4)"
  - "Synthetic D-07 fixture until school file supplied; regenerate via generate-export-fixture.ts"

patterns-established:
  - "buildSummarySheetColumns shared by production and tests"
  - "assertSummaryDetailConsistency: 第k题 === detail 得分 for same 姓名/题号"

requirements-completed: [EXPR-03, EXPR-04]

duration: 25min
completed: 2026-05-17
---

# Phase 5 Plan 01 Summary

**成绩汇总** export is now a wide table (5 fixed columns + 第1题…第N题) with per-question `pointsAwarded`; **答题明细** unchanged.

## Performance

- **Duration:** ~25 min
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- Extended `buildExamExportWorkbook` with `examQuestion.findMany` and dynamic summary columns (D-01–D-06).
- Added `export-summary.ts` pure helpers and `export-workbook.test.ts` with D-08 summary/detail consistency checks.
- Committed synthetic `fixtures/export/test1-成绩导出.xlsx` (masked IDs only); operator may replace with校方样例.

## Files Created/Modified

- `apps/server/src/lib/exam/export-summary.ts` — `perQuestionScoresForSummary`, `buildSummaryRowQuestionFields`
- `apps/server/src/lib/exam/export-workbook.ts` — wide summary, `buildSummarySheetColumns` export
- `apps/server/src/lib/exam/export-workbook.test.ts` — unit + round-trip + fixture smoke
- `fixtures/export/test1-成绩导出.xlsx` — D-07 reference (synthetic)
- `apps/server/scripts/generate-export-fixture.ts` — regenerate fixture

## Self-Check: PASSED

- `node --import tsx --test apps/server/src/lib/exam/export-workbook.test.ts` — 9/9 pass
- `pnpm --filter @lan-exam/server exec tsc -b --noEmit` — pass

## Deviations

- **Task 1 (D-07):** School `test1-成绩导出.xlsx` was not in workspace; committed **synthetic** fixture matching header layout (姓名…第1题…). Replace with校方 file when available; re-run `node --import tsx apps/server/scripts/generate-export-fixture.ts` only for dev regen.

## Human Verification (recommended)

- Export an ended exam from admin UI → open xlsx → confirm 成绩汇总 has 5+N columns and 答题明细 unchanged.

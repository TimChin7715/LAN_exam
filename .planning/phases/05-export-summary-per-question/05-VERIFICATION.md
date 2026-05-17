---
phase: 05-export-summary-per-question
status: passed
verified: 2026-05-17
---

# Phase 5 Verification

## Must-Haves

| Truth | Status | Evidence |
|-------|--------|----------|
| Fixed 5 cols + 第1题…第N题 (N = exam question count) | ✓ | `buildSummarySheetColumns` + `examQuestion.findMany` |
| Submitted per-question cells match detail 得分 | ✓ | `assertSummaryDetailConsistency` test; same `pointsAwarded` source |
| Unsubmitted: — for total and all question cols | ✓ | `perQuestionScoresForSummary` + summary row tests |
| Submitted missing Answer → 0 | ✓ | `byId.get(eq.id) ?? 0` |
| Detail sheet 8 columns unchanged | ✓ | Detail block unchanged; regression test |

## Automated

- `node --import tsx --test apps/server/src/lib/exam/export-workbook.test.ts` — pass (9 tests)
- `pnpm --filter @lan-exam/server exec tsc -b --noEmit` — pass

## Requirements

- **EXPR-03:** ✓ Wide 成绩汇总
- **EXPR-04:** ✓ 答题明细 unchanged

## Human Verification

Optional: export live exam from admin UI and compare to校方样例 (replace synthetic fixture when available).

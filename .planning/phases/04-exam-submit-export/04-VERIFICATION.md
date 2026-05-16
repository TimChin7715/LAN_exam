---
phase: 04-exam-submit-export
status: passed
verified: 2026-05-16
---

# Phase 4 Verification

## Must-haves

| Requirement | Status | Evidence |
|-------------|--------|----------|
| EXAM-01 Exam create/start/student take | passed | `04-01`/`04-02` APIs + `AdminExams`, `StudentExamTake` |
| EXAM-02 One-time submit 409 | passed | `submit.ts`, `exam-submit.ts`, unique constraint |
| EXPR-01 Summary export | passed | `export-workbook.ts` sheet 成绩汇总 |
| EXPR-02 Detail export | passed | sheet 答题明细 |
| D-01 Three states | passed | `ExamStatus` in schema |
| D-02 Start exam | passed | `startExam`, waiting poll |
| D-03 4s poll | passed | `StudentWaiting.tsx` |
| D-04 End exam | passed | `endExam` |

## Automated checks

- `pnpm build` — pass
- `node --import tsx --test apps/server/src/lib/exam/score-question.test.ts` — 8/8 pass

## Human verification

Manual UAT recommended: create exam → start → student submit → export xlsx → verify masked ID columns.

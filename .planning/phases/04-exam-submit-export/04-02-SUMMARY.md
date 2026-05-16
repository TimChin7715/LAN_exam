---
phase: 04-exam-submit-export
plan: 02
subsystem: api
tags: [exam, submit, scoring, exceljs-prep]

requires:
  - phase: 04-exam-submit-export
    plan: 01
    provides: Exam domain APIs and drafts
provides:
  - Server-side submit scoring (QBANK-02 ALL_OR_NOTHING)
  - Teacher end exam (D-04) and submission list APIs
  - Admin exam UI and student take/submit UI
affects: [04-03-export]

tech-stack:
  added: []
  patterns:
    - "submitExam transaction with unique Submission per exam+roster"
    - "Student submission replay without answerKeys"

key-files:
  created:
    - apps/server/src/lib/exam/score-question.ts
    - apps/server/src/lib/exam/submit.ts
    - apps/server/src/routes/api/admin/exams-submissions.ts
    - apps/server/src/routes/api/student/exam-submit.ts
    - apps/server/src/routes/api/student/exam-submission.ts
    - apps/web/src/pages/AdminExams.tsx
    - apps/web/src/pages/AdminExamDetail.tsx
    - apps/web/src/pages/StudentExamTake.tsx
  modified:
    - apps/server/src/lib/exam/transition.ts
    - apps/web/src/router.tsx

requirements-completed: [EXAM-01, EXAM-02]

duration: 60min
completed: 2026-05-16
---

# Phase 4 Plan 02: Submit, Scoring, and End Exam Summary

**Server-side scoring on submit, one-time submit with 409, teacher end exam, admin submission list, and full student/admin exam UI.**

## Accomplishments

- `scoreQuestion` + 8 unit tests aligned with QBANK-02.
- `submitExam` transaction, `endExam` (D-04), admin/student submission routes.
- `/admin/exams`, exam detail with start/end and grade table.
- `/exam/take` with debounced save, submit dialog, read-only replay.

## Task Commits

| Task | Commit |
|------|--------|
| 1 | `3444722` test(04-02): scoreQuestion |
| 2 | `9f04217` feat(04-02): submit APIs |
| 3–4 | `9d20a38` feat(04-02): exam UI |

## Self-Check: PASSED

- `pnpm build` passes
- `node --import tsx --test apps/server/src/lib/exam/score-question.test.ts` passes

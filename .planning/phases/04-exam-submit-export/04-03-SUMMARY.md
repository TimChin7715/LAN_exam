---
phase: 04-exam-submit-export
plan: 03
subsystem: api
tags: [export, exceljs, expr]

requires:
  - phase: 04-exam-submit-export
    plan: 02
    provides: Submissions and Answer rows
provides:
  - Dual-sheet xlsx export with masked national IDs
  - Admin one-click download
affects: []

key-files:
  created:
    - apps/server/src/lib/exam/export-workbook.ts
    - apps/server/src/lib/exam/mask-national-id.ts
    - apps/server/src/routes/api/admin/exams-export.ts
  modified:
    - apps/web/src/pages/AdminExamDetail.tsx
    - apps/web/src/lib/exam.ts

requirements-completed: [EXPR-01, EXPR-02]

duration: 30min
completed: 2026-05-16
---

# Phase 4 Plan 03: Export Summary

**ExcelJS dual-sheet export: 成绩汇总 + 答题明细, masked IDs, unsubmitted rows in summary.**

## Self-Check: PASSED

- `pnpm build` passes
- Export route registered at `GET /api/admin/exams/:id/export`

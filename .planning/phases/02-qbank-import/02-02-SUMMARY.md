---
phase: 02-qbank-import
plan: 02-02
subsystem: ui
tags: [react, shadcn, qbank, xlsx, admin, import]

requires:
  - phase: 02-qbank-import
    plan: 02-01
    provides: Admin import/list/template APIs, question models
provides:
  - /admin/questions page with Excel import UX
  - Import success summary, error table, and preview cards
  - Paginated question list with detail Dialog
affects: [02-03, phase-4-scoring]

tech-stack:
  added: [shadcn table, dialog, badge, select]
  patterns:
    - "Multipart import via fetch credentials include; list/detail via apiFetch"
    - "Client-side xlsx validation before POST (5MB cap)"

key-files:
  created:
    - apps/web/src/pages/AdminQuestions.tsx
    - apps/web/src/lib/qbank.ts
    - apps/web/src/components/admin/qbank/ImportDropzone.tsx
    - apps/web/src/components/admin/qbank/ImportResultSummary.tsx
    - apps/web/src/components/admin/qbank/ImportErrorTable.tsx
    - apps/web/src/components/admin/qbank/QuestionPreviewCards.tsx
    - apps/web/src/components/ui/table.tsx
    - apps/web/src/components/ui/dialog.tsx
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/components/ui/select.tsx
  modified:
    - apps/web/src/router.tsx
    - apps/web/src/pages/AdminDashboard.tsx
    - apps/server/src/routes/api/admin/questions-import.ts
    - apps/web/package.json

key-decisions:
  - "Routes registered in router.tsx (project uses AppRouter, not App.tsx)"
  - "Import preview API extended with options array for stem/answer/option preview cards"

patterns-established:
  - "Qbank UI components under components/admin/qbank/"
  - "Import flow state lifted in AdminQuestions with list refetch on success"

requirements-completed: [QBANK-01, QBANK-03]

duration: 35min
completed: 2026-05-16
---

# Phase 2 Plan 02: 单选与判断导入预览 UI Summary

**Admin question bank page with Excel template download, import feedback, paginated list, and detail dialog wired to Phase 2 APIs**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-16T14:00:00Z
- **Completed:** 2026-05-16T14:35:00Z
- **Tasks:** 4
- **Files modified:** 14

## Accomplishments

- Enabled dashboard 题库 card linking to `/admin/questions` under existing `AdminLayout` auth shell
- Built import dropzone with template download, client validation, and multipart POST to import API
- Rendered success summary with toast, stats, and up to 3 preview cards; failure path shows row-level error table
- Added paginated question list (pageSize 20), type filter, and detail Dialog with full stem/options/answer/explanation

## Task Commits

1. **Task 1: 路由与仪表盘入口（S0/S1）** - `81433ba` (feat)
2. **Task 2: 导入区 — 模板下载与上传（S2）** - `446501b` (feat)
3. **Task 3: 成功/失败反馈与本批预览（S3/S4）** - `b57b897` (feat)
4. **Task 4: 题目列表与详情 Dialog（S5–S7）** - `55e3498` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `apps/web/src/router.tsx` - `/admin/questions` route
- `apps/web/src/pages/AdminDashboard.tsx` - Active 题库 link
- `apps/web/src/pages/AdminQuestions.tsx` - Full qbank management page
- `apps/web/src/lib/qbank.ts` - API helpers and labels
- `apps/web/src/components/admin/qbank/*` - Import and preview UI
- `apps/server/src/routes/api/admin/questions-import.ts` - Preview payload includes options

## Decisions Made

- Used `router.tsx` instead of plan’s `App.tsx` — project routing lives in `AppRouter`
- Extended `previewQuestions` API with `options` so preview cards match UI-SPEC S5

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Include options in import preview API**
- **Found during:** Task 3
- **Issue:** Backend `previewQuestions` omitted options; UI-SPEC requires option list in preview cards
- **Fix:** Map `options` into preview payload from parsed questions
- **Files modified:** apps/server/src/routes/api/admin/questions-import.ts
- **Committed in:** `b57b897`

---

**Total deviations:** 1 auto-fixed (missing critical)
**Impact on plan:** Small API extension; no scope creep.

## Issues Encountered

None blocking. `pnpm run build` passes for `@lan-exam/web`.

## User Setup Required

None — uses existing session cookies and Phase 2 APIs.

## Next Phase Readiness

- 02-03 can focus on multi-select answer display polish and Dialog scoring copy verification
- E2E manual test: login → 题库 → download template → import non-example rows xlsx

## Self-Check: PASSED

- FOUND: apps/web/src/pages/AdminQuestions.tsx
- FOUND: apps/web/src/components/admin/qbank/ImportDropzone.tsx
- FOUND: apps/web/src/router.tsx
- FOUND: 81433ba, 446501b, b57b897, 55e3498

---
*Phase: 02-qbank-import*
*Completed: 2026-05-16*

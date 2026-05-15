---
phase: 03-roster-student-entry
plan: 01
subsystem: api
tags: [prisma, exceljs, fastify, roster, national-id, xlsx]

requires:
  - phase: 02-qbank-import
    provides: requireAdminSession, multipart xlsx import patterns, AdminLayout UI
provides:
  - RosterImportBatch and RosterEntry models with migration
  - Server roster parse/validate/import pipeline with GB 11643 format gate
  - Admin APIs for roster template, import, and searchable list
  - Admin roster UI at /admin/roster with masked ID display
affects: [03-02, phase-4-exam]

tech-stack:
  added: []
  patterns:
    - "Roster ALL_OR_NOTHING: validate including cross-DB duplicate precheck, then single transaction"
    - "Sheet 名单导入; skip 【示例】 rows; nationalId stored plaintext per D-02"

key-files:
  created:
    - apps/server/src/lib/roster/national-id.ts
    - apps/server/src/lib/roster/parse-workbook.ts
    - apps/server/src/lib/roster/validate-rows.ts
    - apps/server/src/lib/roster/import-roster.ts
    - apps/server/src/routes/api/admin/roster-import.ts
    - apps/server/src/routes/api/admin/roster-template.ts
    - apps/server/src/routes/api/admin/roster-list.ts
    - apps/web/src/pages/AdminRoster.tsx
    - apps/web/src/lib/roster.ts
    - docs/templates/名单导入模板.xlsx
    - prisma/migrations/20260516140000_roster_entries/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/server/src/index.ts
    - apps/web/src/router.tsx
    - apps/web/src/pages/AdminDashboard.tsx

key-decisions:
  - "Roster import rejects entire batch on any row error or existing (fullName, nationalId) duplicate"
  - "Admin list masks nationalId as first6+********+last4; API returns full value for search"
  - "ROSTER_IMPORT_RATE_LIMIT_MAX defaults to 10/min separate from question import"

patterns-established:
  - "lib/roster mirrors lib/qbank two-phase import with RosterTemplateError"
  - "First server unit test: national-id.test.ts via node:test + tsx"

requirements-completed: [ROST-01]

duration: 45min
completed: 2026-05-16
---

# Phase 3 Plan 01: 名单导入与检索 Summary

**Roster Excel import with GB 11643 validation, atomic batch writes, admin search UI, and masked ID list at /admin/roster**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-16T12:00:00Z
- **Completed:** 2026-05-16T12:45:00Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- Added `RosterImportBatch` / `RosterEntry` Prisma models and `20260516140000_roster_entries` migration (applied via `migrate deploy`)
- Implemented roster import pipeline: ExcelJS display-text parsing, batch + cross-DB duplicate checks, `$transaction` write
- Delivered admin template/import/list APIs and `/admin/roster` UI with import dropzone, error table, search, and pagination

## Task Commits

1. **Task 1: 教师可导入名单（后端垂直切片）** - `c1401cb` (feat)
2. **Task 2: [BLOCKING] Prisma migrate 应用名单 schema** - `a9ab595` (chore)
3. **Task 3: 教师可在管理端导入并检索名单（前端垂直切片）** - `e0cde98` (feat)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `prisma/schema.prisma` - Roster models and Teacher relation
- `apps/server/src/lib/roster/*.ts` - Parse, validate, national-id, import
- `apps/server/src/routes/api/admin/roster-*.ts` - Template, import, list routes
- `docs/templates/名单导入模板.xlsx` - Official roster template with text-formatted ID column
- `apps/web/src/pages/AdminRoster.tsx` - Import + search UI per UI-SPEC S1–S5
- `apps/web/src/lib/roster.ts` - API client and `maskNationalId`

## Decisions Made

- Cross-database duplicate detection runs in validate phase (not relying solely on DB unique constraint errors)
- Import logs omit full `nationalId` (T-03-06)
- Migration created manually with `migrate diff` blocked by session-table drift; `migrate deploy` applied successfully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `prisma migrate dev` blocked by session-table drift**
- **Found during:** Task 2
- **Issue:** Local DB had `session` table not in migration history; `migrate dev` required reset
- **Fix:** Authored `prisma/migrations/20260516140000_roster_entries/migration.sql` manually and applied with `migrate deploy`
- **Files modified:** `prisma/migrations/20260516140000_roster_entries/migration.sql`
- **Commit:** `a9ab595`

None otherwise — plan executed as written.

## Self-Check

- FOUND: apps/server/src/lib/roster/national-id.ts
- FOUND: apps/server/src/routes/api/admin/roster-import.ts
- FOUND: apps/web/src/pages/AdminRoster.tsx
- FOUND: docs/templates/名单导入模板.xlsx
- FOUND: prisma/migrations/20260516140000_roster_entries/migration.sql
- FOUND: c1401cb
- FOUND: a9ab595
- FOUND: e0cde98

**Self-Check: PASSED**

---
phase: 02-qbank-import
plan: 02-01
subsystem: api
tags: [prisma, exceljs, fastify, multipart, qbank, xlsx]

requires:
  - phase: 01-foundation-auth
    provides: Teacher model, requireAdminSession, session cookies
provides:
  - Question domain Prisma models and migration
  - Server-side Excel parse/validate/import pipeline
  - Admin APIs for template download, import, list, and detail
affects: [02-02, 02-03, phase-4-scoring]

tech-stack:
  added: [exceljs, @fastify/multipart]
  patterns:
    - "Two-phase import: validate all rows in memory, then single prisma.$transaction"
    - "Sheet 题库导入 only; skip 【示例】 rows; MULTI uses ALL_OR_NOTHING"

key-files:
  created:
    - apps/server/src/lib/qbank/parse-workbook.ts
    - apps/server/src/lib/qbank/validate-rows.ts
    - apps/server/src/lib/qbank/import-questions.ts
    - apps/server/src/routes/api/admin/questions-import.ts
    - apps/server/src/routes/api/admin/questions-template.ts
    - apps/server/src/routes/api/admin/questions-list.ts
    - prisma/migrations/20260516120000_qbank_questions/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/server/src/index.ts
    - apps/server/package.json
    - Dockerfile

key-decisions:
  - "MULTI questions persist multiScoringRule ALL_OR_NOTHING per D-07 and research"
  - "Official template may contain only 【示例】 rows; import rejects zero importable rows with NO_QUESTIONS"
  - "Docker image copies docs/templates for production template download"

patterns-established:
  - "Admin question routes use requireAdminSession and Zod for query params"
  - "Import errors return { ok: false, errors: [{ row, column?, message }] } without stack traces"

requirements-completed: [QBANK-01, QBANK-02, QBANK-03]

duration: 45min
completed: 2026-05-16
---

# Phase 2 Plan 01: 题库导入后端管道 Summary

**Prisma question domain with ExcelJS parse/validate, atomic batch import, and admin template/import/list APIs with ALL_OR_NOTHING multi-select scoring**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-16T12:00:00Z
- **Completed:** 2026-05-16T12:45:00Z
- **Tasks:** 4
- **Files modified:** 18

## Accomplishments

- Extended schema with `Question`, `QuestionOption`, `QuestionImportBatch`, and enums; migration `20260516120000_qbank_questions` applied via `migrate deploy`
- Implemented `parseWorkbook` / `validateRows` / `importQuestions` with D-02–D-09 rules, 2000-row cap, and 5MB multipart limit
- Registered `GET /api/admin/questions/template`, `POST /api/admin/questions/import`, `GET /api/admin/questions`, `GET /api/admin/questions/:id` behind `requireAdminSession`

## Task Commits

1. **Task 1: Prisma 题目域模型与迁移** - `f578f89` (feat)
2. **Task 2: Excel 解析、校验与事务导入库** - `a0cd719` (feat)
3. **Task 3: Admin API — 模板、导入、列表、详情** - `047087d` (feat)
4. **Task 4: Prisma migrate 应用 schema** - `8a795d8` (chore, migrate deploy verified)

**Plan metadata:** pending orchestrator merge commit

## Files Created/Modified

- `prisma/schema.prisma` - Question domain models and Teacher relation
- `apps/server/src/lib/qbank/*.ts` - Parse, validate, normalize, import, xlsx checks
- `apps/server/src/routes/api/admin/questions-*.ts` - Template, import, list/detail routes
- `apps/server/src/index.ts` - Multipart plugin and route registration
- `Dockerfile` - Copy `docs/templates` into production image for template endpoint

## Decisions Made

- MULTI questions always store `multiScoringRule: ALL_OR_NOTHING` at import time (QBANK-02)
- Import returns 400 with `NO_QUESTIONS` when every row is skipped (e.g. template-only examples)
- Rate limit on import endpoint (10/min default, overridable via `IMPORT_RATE_LIMIT_MAX`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Copy template into Docker production image**
- **Found during:** Task 3
- **Issue:** Production Dockerfile did not include `docs/templates/`; template download would 404 in Compose
- **Fix:** Added `COPY docs/templates docs/templates` to Dockerfile
- **Files modified:** Dockerfile
- **Committed in:** `047087d`

**2. [Rule 1 - Bug] Single-choice answer must exist in option keys**
- **Found during:** Task 2 verification script
- **Issue:** `normalizeAnswerKeys` accepted any A–Z letter for SINGLE without checking options
- **Fix:** Reject letters not present in `optionKeys`
- **Files modified:** apps/server/src/lib/qbank/normalize-answer.ts
- **Committed in:** `a0cd719`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Required for correct validation and deployable template API; no scope creep.

## Issues Encountered

- Executor spawned on `main`; created `worktree-agent-02-01-executor` branch before commits per worktree safety rules
- `prisma migrate dev --create-only` reported drift (session table); migration SQL authored manually and applied cleanly with `migrate deploy`

## User Setup Required

None - uses existing `DATABASE_URL` and Phase 1 auth.

## Next Phase Readiness

- Backend contract ready for 02-02/02-03 admin UI (upload, errors table, list/preview)
- E2E import test needs fixture xlsx with non-example rows (official template skips all three examples)

## Self-Check: PASSED

- FOUND: prisma/schema.prisma
- FOUND: apps/server/src/lib/qbank/parse-workbook.ts
- FOUND: apps/server/src/routes/api/admin/questions-import.ts
- FOUND: prisma/migrations/20260516120000_qbank_questions/migration.sql
- FOUND: f578f89, a0cd719, 047087d, 8a795d8

---
*Phase: 02-qbank-import*
*Completed: 2026-05-16*

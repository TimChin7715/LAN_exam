---
phase: 04-exam-submit-export
plan: 01
subsystem: api
tags: [prisma, fastify, exam, exam-status, answer-draft, student-polling]

requires:
  - phase: 02-qbank-import
    provides: Question batches and questions for exam materialization
  - phase: 03-roster-student-entry
    provides: Roster batches, student session rosterEntryId
provides:
  - Exam domain Prisma models (DRAFT/IN_PROGRESS/ENDED)
  - Teacher exam CRUD and explicit start (D-02)
  - Student paper/draft APIs without answerKeys leakage
  - StudentWaiting 4s status poll with auto-navigate (D-03)
affects: [04-02-exam-ui-submit, 04-03-export]

tech-stack:
  added: []
  patterns:
    - "assertStudentExamAccess gates all student exam routes by roster batch"
    - "materializeExamQuestions snapshots batch questions at DRAFT create/patch"
    - "One IN_PROGRESS exam per roster batch enforced in startExam"

key-files:
  created:
    - apps/server/src/lib/exam/access.ts
    - apps/server/src/lib/exam/materialize-questions.ts
    - apps/server/src/lib/exam/transition.ts
    - apps/server/src/routes/api/admin/exams-crud.ts
    - apps/server/src/routes/api/admin/exams-lifecycle.ts
    - apps/server/src/routes/api/admin/exam-batches.ts
    - apps/server/src/routes/api/student/exam-status.ts
    - apps/server/src/routes/api/student/exam-paper.ts
    - apps/server/src/routes/api/student/exam-answers.ts
    - prisma/migrations/20260516160000_exam_domain/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/server/src/index.ts
    - apps/server/src/routes/api/student/index.ts
    - apps/web/src/lib/student.ts
    - apps/web/src/pages/StudentWaiting.tsx

key-decisions:
  - "Whole-batch question/roster binding with ExamQuestion materialization on DRAFT only"
  - "Generic 403 for roster mismatch; 409 for ENDED write and duplicate IN_PROGRESS per batch"
  - "endExam stub returns 501 until 04-02"

patterns-established:
  - "ExamAccessError / ExamTransitionError carry statusCode + code for route mapping"
  - "Student exam paper select omits answerKeys; drafts merged into paper response"

requirements-completed: [EXAM-01]

duration: 45min
completed: 2026-05-16
---

# Phase 4 Plan 01: Exam Domain Backend + Start Signal Summary

**Prisma exam lifecycle (三态), teacher CRUD/start APIs, student paper/draft endpoints without answer keys, and 4s waiting-page poll to `/exam/take`.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-16T00:00:00Z
- **Completed:** 2026-05-16T00:45:00Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- Added `Exam`, `ExamQuestion`, `AnswerDraft`, `Submission`, `Answer` models with `ExamStatus` enum (D-01).
- Implemented `startExam` with same-roster-batch single `IN_PROGRESS` guard (D-02).
- Delivered admin exam CRUD, batch pickers, and student status/paper/answers APIs.
- Extended `StudentWaiting` with 4s polling, visibility pause, and auto-navigation (D-03).

## Task Commits

1. **Task 1: Exam schema、准入与组卷服务** - `d12fe22` (feat)
2. **Task 2: Prisma migrate 应用考试 schema** - `e2f2e82` (chore)
3. **Task 3: 考试 Admin/Student API 与学生准备页轮询** - `bffc23e` (feat)

**Plan metadata:** pending (docs commit with SUMMARY)

## Files Created/Modified

- `prisma/schema.prisma` - Exam domain models and relations
- `prisma/migrations/20260516160000_exam_domain/migration.sql` - SQL migration for deploy
- `apps/server/src/lib/exam/*.ts` - Access, materialize, start transition
- `apps/server/src/routes/api/admin/exams-*.ts` - Teacher APIs
- `apps/server/src/routes/api/student/exam-*.ts` - Student APIs
- `apps/web/src/pages/StudentWaiting.tsx` - D-03 polling UX

## Decisions Made

- Followed RESEARCH defaults: whole-batch binding, generic forbidden message, 60/min answer rate limit.
- `endExam` left as 501 stub for 04-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PostgreSQL unavailable for `migrate dev`**
- **Found during:** Task 2
- **Issue:** Docker Desktop engine not running (`P1001` on localhost:5434)
- **Fix:** Authored migration SQL manually from schema; ran `prisma generate`; `migrate deploy` deferred to runtime Docker/CI
- **Files modified:** `prisma/migrations/20260516160000_exam_domain/migration.sql`
- **Verification:** `prisma validate` and `prisma generate` succeeded
- **Committed in:** `e2f2e82`

**2. [Rule 1 - Bug] `startExam` return type narrowing**
- **Found during:** Task 3 (`tsc`)
- **Issue:** Prisma `ExamStatus` union not narrowed after update
- **Fix:** Explicit return object with `IN_PROGRESS` const and non-null `startedAt`
- **Files modified:** `apps/server/src/lib/exam/transition.ts`
- **Committed in:** `bffc23e`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Migration file is complete; apply with `pnpm db:migrate` when DB is up. No scope change.

## Issues Encountered

- Local Docker not running prevented live `migrate deploy` verification; migration SQL committed for compose entrypoint.

## User Setup Required

None — run `docker compose up` (or `pnpm db:migrate`) before integration testing against a live database.

## Next Phase Readiness

- Backend ready for 04-02: admin exam UI, `StudentExamTake`, submit/scoring, `endExam`.
- Run `pnpm exec prisma migrate deploy` once Postgres is available.

## Self-Check: PASSED

- FOUND: prisma/schema.prisma
- FOUND: apps/server/src/lib/exam/access.ts
- FOUND: prisma/migrations/20260516160000_exam_domain/migration.sql
- FOUND: apps/server/src/routes/api/admin/exams-crud.ts
- FOUND: apps/web/src/pages/StudentWaiting.tsx
- FOUND: commit d12fe22
- FOUND: commit e2f2e82
- FOUND: commit bffc23e

---
*Phase: 04-exam-submit-export*
*Completed: 2026-05-16*

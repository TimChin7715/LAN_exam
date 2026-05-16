---
phase: 03-roster-student-entry
plan: 02
subsystem: api
tags: [session, student-auth, fastify, react, roster]

requires:
  - phase: 03-roster-student-entry
    provides: RosterEntry data from 03-01
provides:
  - Dual cookie sessions sid + student_sid
  - POST /api/student/verify, GET /me, POST /logout
  - Student exam login and waiting UI with StudentRoute guard
  - 03-ACCEPTANCE.md for Phase 3 manual verification
affects: [phase-4-exam]

tech-stack:
  added: []
  patterns:
    - "Chained express-session: studentSession on raw, restore teacher req.session"
    - "Student verify: format gate before DB; generic 401 on mismatch"

key-files:
  created:
    - apps/server/src/lib/student-auth.ts
    - apps/server/src/plugins/student-guard.ts
    - apps/server/src/routes/api/student/verify.ts
    - apps/server/src/routes/api/student/me.ts
    - apps/server/src/routes/api/student/logout.ts
    - apps/web/src/lib/student.ts
    - apps/web/src/lib/national-id.ts
    - apps/web/src/pages/StudentLogin.tsx
    - apps/web/src/pages/StudentWaiting.tsx
    - apps/web/src/components/auth/StudentRoute.tsx
    - .planning/phases/03-roster-student-entry/03-ACCEPTANCE.md
  modified:
    - apps/server/src/plugins/session.ts
    - apps/server/src/types/session.d.ts
    - apps/server/src/lib/errors.ts
    - apps/server/src/index.ts
    - apps/web/src/router.tsx
    - apps/web/src/pages/Home.tsx

key-decisions:
  - "student_sid independent from sid; teacher session preserved on verify"
  - "Session stores studentRosterEntryId only; /me loads full nationalId from DB"
  - "401 uses single STUDENT_AUTH_ERROR_MESSAGE for any roster mismatch"

patterns-established:
  - "studentApi uses skipAuthRedirect to avoid teacher session toast"
  - "StudentRoute mirrors AdminRoute with /exam/login and /exam/waiting redirects"

requirements-completed: [AUTH-02]

duration: 40min
completed: 2026-05-16
---

# Phase 3 Plan 02: 学生入场 Summary

**Independent student_sid session with roster-bound verify, generic failure copy, and exam login/waiting UI guarded by StudentRoute**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-05-16
- **Tasks:** 2

## Accomplishments

- Chained dual `express-session` middleware with `student_sid` cookie and `getStudentSession()`
- Student verify API: GB 11643 format gate, exact roster match, rate limit, session regenerate
- Frontend `/exam/login` and `/exam/waiting` with full identity display and StudentRoute guards
- `03-ACCEPTANCE.md` documenting Phase 3 ROADMAP success criteria

## Task Commits

1. **Task 1: 考生验证通过并进入准备页** - `bac376e` (feat)
2. **Task 2: 学生路由守卫与验收文档** - `374ab5c` (feat)

**Plan metadata:** pending docs commit

## Self-Check

- FOUND: apps/server/src/plugins/session.ts (student_sid)
- FOUND: apps/server/src/routes/api/student/verify.ts
- FOUND: apps/web/src/pages/StudentWaiting.tsx
- FOUND: apps/web/src/components/auth/StudentRoute.tsx
- FOUND: bac376e
- FOUND: 374ab5c

**Self-Check: PASSED**

## Post-ship revisions (2026-05-17)

**Supersedes portions of this summary** — see `03-CONTEXT.md` D-05 revision.

| Issue | Root cause | Fix |
|-------|------------|-----|
| 开发环境反复「登录不了」 | 仅起 Web、根目录端口与 Vite 代理不一致；`auth/me` 401 触发全局踢登 | D-09：`pnpm dev`/`dev:web` 并行 API+Web；根 `.env` `API_PORT`/`WEB_PORT`；`apiHealthCheckPlugin` |
| 教师端闪退回登录 | 双 `student_sid` 链式中间件 session 未可靠落库；所有 401 走教师过期 handler | D-05/D-10：单 `sid` 字段隔离 + `saveSession`；`skipAuthRedirect`；改密 403；`AuthContext` 仅首次 checking |

Original delivery (2026-05-16) used `student_sid` dual middleware — **removed** in favor of unified `sid` + explicit persistence.

---
phase: 01-foundation-auth
plan: 01-03
subsystem: auth
tags: [express-session, connect-pg-simple, fastify, react-router, shadcn, argon2, rate-limit]

requires:
  - phase: 01-foundation-auth
    plan: 01-02
    provides: Teacher model, teacher_admin seed, Prisma client
provides:
  - Session-backed teacher login with HttpOnly sid cookie
  - Auth API (login, logout, me, change-password) and admin ping guard
  - Admin SPA with UI-SPEC copy, route guards, and dashboard placeholder
affects: [02-01, phase-2]

tech-stack:
  added: [express-session, connect-pg-simple, pg, @fastify/rate-limit, react-router-dom, react-hook-form, sonner]
  patterns: [credentials include fetch, regenerate session on login, mustChangePassword API gate]

key-files:
  created:
    - apps/server/src/plugins/session.ts
    - apps/server/src/routes/api/auth/login.ts
    - apps/server/src/routes/api/auth/change-password.ts
    - apps/server/src/routes/api/admin/ping.ts
    - apps/web/src/lib/api.ts
    - apps/web/src/router.tsx
    - apps/web/src/pages/AdminLogin.tsx
    - apps/web/src/pages/AdminChangePassword.tsx
    - apps/web/src/pages/AdminDashboard.tsx
  modified:
    - apps/server/src/index.ts
    - apps/web/src/main.tsx
    - apps/web/vite.config.ts
    - .env.example

key-decisions:
  - "Session cookie name sid; connect-pg-simple store with createTableIfMissing"
  - "Vite /api proxy forwards full path (no strip) to match server /api/* routes"
  - "UI theme tokens in index.css + globals.css per UI-SPEC hex values"

patterns-established:
  - "apiFetch with credentials include and 401 session-expired toast + redirect"
  - "AdminRoute four-state guard matrix (checking, unauthenticated, mustChangePassword, authenticated)"

requirements-completed: [AUTH-01]

duration: 45min
completed: 2026-05-15
---

# Phase 01 Plan 03: Teacher Auth Summary

**express-session + PostgreSQL store with HttpOnly cookie, unified login errors, first-login password change gate, and admin SPA aligned to 01-UI-SPEC.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-05-15
- **Tasks:** 2
- **Files modified:** 40

## Accomplishments

- `POST /api/auth/login` with rate limit, session regenerate, `INVALID_CREDENTIALS` unified message
- `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/change-password` with argon2 verify/hash
- `/api/admin/ping` protected by session + `mustChangePassword=false` preHandler
- React Router admin flow: login → change-password → dashboard; student `/` placeholder
- Structured log `auth_login_failed` without password field

## Task Commits

1. **Task 1: 会话中间件与认证 API** - `a7b6fa4` (feat)
2. **Task 2: 管理端 SPA 页面、路由守卫** - `f29c6ac` (feat)

**Plan metadata:** _(pending docs commit)_

## Files Created/Modified

- `apps/server/src/plugins/session.ts` - express-session + connect-pg-simple
- `apps/server/src/routes/api/auth/*.ts` - login, logout, me, change-password
- `apps/server/src/plugins/admin-guard.ts` - admin API authorization
- `apps/web/src/lib/api.ts` - fetch wrapper with `credentials: 'include'`
- `apps/web/src/contexts/AuthContext.tsx` - session bootstrap and status
- `apps/web/src/router.tsx` - `/`, `/admin/*` routes and guards

## Decisions Made

- `SESSION_SECRET` required in production; dev fallback documented in `.env.example`
- `secure` cookie when `NODE_ENV=production` and `TRUST_PROXY=true`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vite proxy preserved `/api` prefix**
- **Found during:** Task 1 verification
- **Issue:** Existing proxy rewrote `/api` away, breaking `/api/auth/*` server routes
- **Fix:** Removed `rewrite` in `vite.config.ts`
- **Files modified:** `apps/web/vite.config.ts`
- **Commit:** `a7b6fa4`

**2. [Rule 3 - Blocking] Added `pg` and `@types/*` for session store build**
- **Found during:** `tsc` build
- **Fix:** Added `pg`, `@types/pg`, `@types/connect-pg-simple`; Fastify `trustProxy` via constructor option
- **Commit:** `a7b6fa4`

## Issues Encountered

- End-to-end `curl` login not run in executor environment (no Postgres container up); `pnpm --filter @lan-exam/server build` and `@lan-exam/web build` both pass.

## Next Phase Readiness

- AUTH-01 demonstrable when stack is up with `SEED_ADMIN_PASSWORD` and `SESSION_SECRET`
- Phase 2 can attach admin features behind `/api/admin/*` guard

## Self-Check: PASSED

- [x] `apps/server/src/routes/api/auth/login.ts` exists
- [x] `apps/web/src/pages/AdminLogin.tsx` exists
- [x] Commits `a7b6fa4`, `f29c6ac` on `main`
- [x] `pnpm --filter @lan-exam/server build` exit 0
- [x] `pnpm --filter @lan-exam/web build` exit 0
- [x] No `忘记密码` in `apps/web` user-visible strings

---
*Phase: 01-foundation-auth*
*Completed: 2026-05-15*

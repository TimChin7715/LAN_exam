# GSD Decisions Index (rolling)

**Purpose:** Bounded summary for discuss/plan/execute agents. **Authoritative detail** lives in phase `*-CONTEXT.md` files; this index only lists cross-cutting decisions that changed after initial plans.

**Last updated:** 2026-05-17

---

## Auth, session, and dev environment

| ID | Topic | Current decision | Supersedes | Detail |
|----|-------|------------------|------------|--------|
| D-09 | Dev startup & ports | Root `.env` `API_PORT`/`WEB_PORT`; `pnpm dev` & `dev:web` start API+Web; `dev:web-only` + Vite health warning | Assumption that `dev:web` is web-only | `01-CONTEXT.md` |
| D-10 | Teacher session stability | `saveSession` after login; `skipAuthRedirect` on auth APIs; `mustChangePassword` → 403; `AuthContext` hydrate once | All 401 → logout toast | `01-CONTEXT.md` |
| D-05r | Student vs teacher session | **Single `sid`** cookie; `teacherId` vs `studentRosterEntryId` fields; `saveSession` on verify; student APIs `skipAuthRedirect` | Dual `student_sid` middleware (2026-05-16 plan) | `03-CONTEXT.md` |

---

## When to read what

| Agent task | Read first |
|------------|------------|
| Teacher auth / admin UI | `01-CONTEXT.md` (D-04, D-09, D-10) |
| Student login / waiting | `03-CONTEXT.md` (D-05 revision, D-06–D-08) |
| Exam student APIs | `03-CONTEXT.md` + `04-CONTEXT.md` |
| Codebase map | `.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md` |

---

## Post-ship fix log

| Date | Symptom | Root cause | Resolution |
|------|---------|------------|------------|
| 2026-05-17 | Dev login fails intermittently | Web-only dev; port/proxy mismatch; `auth/me` 401 triggers global redirect | D-09, D-10 |
| 2026-05-17 | Teacher admin flashes to login | Dual `student_sid` PG writes flaky; global 401 handler | D-05r, D-10 |

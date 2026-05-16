# External Integrations

**Analysis Date:** 2026-05-17

## APIs & External Services

**Third-party SaaS / cloud APIs:**
- **None** — No Stripe, Auth0, Supabase, AWS SDK, email, SMS, or AI provider clients in application code under `apps/`

**LAN / browser integration:**
- **Same-origin API via Vite proxy (development)** — Browser calls `/api/*`; Vite forwards to `http://127.0.0.1:${API_PORT}` (`apps/web/vite.config.ts`)
- **Cookie-based session** — `fetch(..., { credentials: 'include' })` in `apps/web/src/lib/api.ts`

## Data Storage

**Databases:**
- **PostgreSQL 16** — Primary and only datastore
  - Connection: `DATABASE_URL` environment variable (`prisma/schema.prisma`, `apps/server/src/plugins/session.ts`)
  - Client: **Prisma** `@prisma/client` — singleton in `apps/server/src/lib/prisma.ts`
  - Local dev: Docker service `db` in `docker-compose.yml` (`postgres:16`, database `lan_exam`, user `lan_exam`)
  - Host mapping: `127.0.0.1:5434:5432` for tools/migrations from host
  - Compose internal URL pattern: `postgresql://lan_exam:...@db:5432/lan_exam` (documented in `docs/DEPLOY.md`; not a secret name)

**Session store (same database):**
- **PostgreSQL table `session`** via `connect-pg-simple`
  - Pool: `pg` `Pool` with `DATABASE_URL` (`apps/server/src/plugins/session.ts`)
  - `createTableIfMissing: true` on first run

**File Storage:**
- **Local filesystem only**
  - Excel templates: `docs/templates/` (e.g. `题库导入模板.xlsx`, `名单导入模板.xlsx`)
  - Test fixtures: `docs/fixtures/import-test/`
  - Template resolution from server: `getRepoRoot()` in `apps/server/src/lib/repo-root.ts`
  - User uploads: **in-memory/multipart** per request — not persisted to object storage; parsed with **ExcelJS** and written to Postgres

**Caching:**
- **None** — No Redis or in-memory cache layer

## Authentication & Identity

**Auth provider:**
- **Custom** — No external IdP

**Teacher (admin) auth:**
- Username/password against `Teacher` model (`prisma/schema.prisma`)
- Password hashing: **argon2** (`apps/server/src/routes/api/auth/login.ts`, `change-password.ts`)
- Session cookie: `sid`, `httpOnly`, `sameSite: 'lax'`, optional `secure` in production (`apps/server/src/plugins/session.ts`)
- Session data: `teacherId` in `express-session` (`apps/server/src/types/session.d.ts`)
- Routes: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/change-password` under `apps/server/src/routes/api/auth/`
- Guards: `apps/server/src/plugins/admin-guard.ts`

**Student auth:**
- **Roster match** — `fullName` + `nationalId` verified against `RosterEntry` (`apps/server/src/routes/api/student/verify.ts`)
- National ID format validation: `apps/server/src/lib/roster/national-id.ts`
- Same `sid` session cookie; fields `studentRosterEntryId`, `studentName` on session (`apps/server/src/types/session.d.ts`)
- Session establishment: `apps/server/src/lib/student-auth.ts` (regenerates session unless teacher already logged in)
- Guards: `apps/server/src/plugins/student-guard.ts`

**OAuth / SSO:**
- **Not used**

**Bootstrap identity:**
- Seed user `teacher_admin` via `prisma/seed.ts` — password from `SEED_ADMIN_PASSWORD` (required for seed and Docker entrypoint)

## Monitoring & Observability

**Error Tracking:**
- **None** — No Sentry, Datadog, or similar

**Logs:**
- **Fastify built-in logger** — `logger: true` in `apps/server/src/index.ts`
- Prisma: `['error', 'warn']` in development, `['error']` in production (`apps/server/src/lib/prisma.ts`)
- Vite dev plugin warns if API health check fails (`apps/web/src/plugins/api-health-check.ts`)

**Health checks:**
- `GET /health` — DB ping via `prisma.$queryRaw\`SELECT 1\`` (`apps/server/src/index.ts`)
- Used for Docker/lab verification per `docs/DEPLOY.md`

## CI/CD & Deployment

**Hosting:**
- **On-prem / classroom LAN** — Docker Compose on a server machine; students/teachers reach via LAN IP (`docs/DEPLOY.md`)

**Container orchestration:**
- `docker-compose.yml` — services `db` (Postgres) and `app` (Node API image built from `Dockerfile`)
- `scripts/docker-entrypoint.sh` — `prisma migrate deploy`, `prisma db seed`, then API process

**CI Pipeline:**
- **Not detected** — No `.github/workflows/` or other CI config in the application repo

**Image registry:**
- Base images from Docker Hub: `node:22-bookworm-slim`, `postgres:16` (`Dockerfile`, `docker-compose.yml`)

## Environment Configuration

**Required env vars:**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection for Prisma and session store |
| `SEED_ADMIN_PASSWORD` | Initial `teacher_admin` password for seed (Docker entrypoint fails if unset) |
| `SESSION_SECRET` | Required in production (≥16 characters) |

**Commonly set (optional):**

| Variable | Purpose |
|----------|---------|
| `API_PORT` / `PORT` | API listen port (default `3101`) |
| `WEB_PORT` | Vite dev port (default `5180`) |
| `HOST` | API bind address (default `0.0.0.0`) |
| `NODE_ENV` | `production` enables strict session secret and secure cookies with proxy |
| `TRUST_PROXY` | Set to `true` when behind reverse proxy |
| `SESSION_MAX_AGE_MS` | Session cookie max age |
| `LOGIN_RATE_LIMIT_MAX` | Teacher login rate limit per minute |
| `IMPORT_RATE_LIMIT_MAX` | Question import rate limit |
| `ROSTER_IMPORT_RATE_LIMIT_MAX` | Roster import rate limit |
| `STUDENT_VERIFY_RATE_LIMIT_MAX` | Student verify rate limit |

**Secrets location:**
- Local: root **`.env`** (exists; contents must not be committed)
- Template: **`.env.example`** (variable names only; safe to commit)
- Docker Compose: inline dev DB credentials in `docker-compose.yml`; `SEED_ADMIN_PASSWORD` passed from host env to `app` service
- Production: operators set `SEED_ADMIN_PASSWORD` and `SESSION_SECRET` at deploy time (`docs/DEPLOY.md`)

**Frontend env:**
- No `VITE_*` public env vars detected — web uses relative `/api` paths and Vite proxy in dev

## Webhooks & Callbacks

**Incoming:**
- **None** — No webhook endpoints

**Outgoing:**
- **None** — No callbacks to external systems

## Import / Export (file-based, not HTTP integrations)

**Excel (.xlsx) workflows** — processed entirely in-process with **ExcelJS**; no external spreadsheet API:

| Flow | Endpoints / code | Templates |
|------|------------------|-----------|
| Question bank import | `apps/server/src/routes/api/admin/questions-import.ts` | `docs/templates/题库导入模板.xlsx` |
| Roster import | `apps/server/src/routes/api/admin/roster-import.ts` | `docs/templates/名单导入模板.xlsx` |
| Exam results export | `apps/server/src/routes/api/admin/exams-export.ts` | Generated workbook in `apps/server/src/lib/exam/export-workbook.ts` |

**Multipart limits:** single file per upload (`limits: { files: 1 }` in `apps/server/src/index.ts`)

## Network & Security Assumptions

- **Intranet HTTP** acceptable for current phase; HTTPS termination optional at reverse proxy (`docs/DEPLOY.md`)
- **Rate limiting** on sensitive routes via `@fastify/rate-limit` (env-tunable caps)
- **No external network dependency** at runtime beyond pulling Docker images (and optional registry access during build)

---

*Integration audit: 2026-05-17*

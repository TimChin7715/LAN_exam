<!-- refreshed: 2026-05-17 -->
# Architecture

**Analysis Date:** 2026-05-17

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (LAN clients)                            │
├──────────────────────────────┬──────────────────────────────────────────┤
│   Student SPA routes         │   Admin SPA routes                        │
│   `/`, `/exam/*`             │   `/admin/*`                              │
│   `apps/web/src/pages/*`     │   `apps/web/src/pages/Admin*.tsx`         │
│   `StudentRoute` guard       │   `AdminRoute` + `AuthContext`            │
└──────────────┬───────────────┴──────────────────┬───────────────────────┘
               │ fetch `/api/*` (credentials)    │
               ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Dev: Vite proxy `apps/web/vite.config.ts` → `127.0.0.1:API_PORT`       │
│  Prod: reverse proxy / separate Web host (see `docs/DEPLOY.md`)         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Fastify API — `apps/server/src/index.ts`               │
│  Plugins: session (`plugins/session.ts`), multipart, rate-limit          │
│  Routes: `/api/auth/*`, `/api/admin/*`, `/api/student/*`, `/health`    │
│  Guards: `plugins/admin-guard.ts`, `plugins/student-guard.ts`            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Domain services — `apps/server/src/lib/{exam,qbank,roster,auth}.ts`    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Prisma Client — `apps/server/src/lib/prisma.ts`                         │
│  Schema — `prisma/schema.prisma`                                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (sessions in `session` table via connect-pg-simple)          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| API bootstrap | Register plugins, wire all route modules, health check | `apps/server/src/index.ts` |
| Session store | Cookie session `sid`, PostgreSQL-backed store | `apps/server/src/plugins/session.ts` |
| Teacher auth | Login, logout, me, password change; `teacherId` on session | `apps/server/src/routes/api/auth/*`, `apps/server/src/lib/auth.ts` |
| Student auth | Roster verify, session fields `studentRosterEntryId` / `studentName` | `apps/server/src/routes/api/student/verify.ts`, `apps/server/src/lib/student-auth.ts` |
| Admin guard | Require teacher session; block if `mustChangePassword` | `apps/server/src/plugins/admin-guard.ts` |
| Student guard | Require `studentRosterEntryId` on session | `apps/server/src/plugins/student-guard.ts` |
| Question bank | XLSX parse, validate, import batches | `apps/server/src/lib/qbank/*` |
| Roster | XLSX parse, validate, import entries | `apps/server/src/lib/roster/*` |
| Exam lifecycle | Start/end, access control, scoring, submit, export | `apps/server/src/lib/exam/*` |
| Web router | Student vs admin URL trees, nested layouts | `apps/web/src/router.tsx` |
| API client | `fetch` with cookies, auth error handling | `apps/web/src/lib/api.ts`, `apps/web/src/lib/student.ts` |
| Admin auth state | Hydrate from `/api/auth/me`, redirect on 401/403 | `apps/web/src/contexts/AuthContext.tsx` |

## Pattern Overview

**Overall:** Layered monorepo — React SPA (presentation) + Fastify HTTP API (application) + Prisma (persistence), with **fat domain modules** under `apps/server/src/lib/` and **thin route handlers** that validate input and call lib functions.

**Key Characteristics:**
- **Explicit route registration:** Each feature exports `register*Routes(app)`; `index.ts` imports and registers them in a fixed order.
- **Session-first security:** No JWT; `express-session` on `request.raw.session` with HTTP-only cookie; teacher and student identities can share one session cookie (proctor testing).
- **Zod at the edge:** Request bodies/queries validated in route files; domain layer throws typed errors (`ExamTransitionError`, `ExamAccessError`, etc.).
- **Batch-oriented content:** Questions and rosters are imported as immutable batches; exams reference batch IDs and snapshot questions via `ExamQuestion`.

## Layers

**Presentation (Web):**
- Purpose: Student exam UX and teacher admin UI
- Location: `apps/web/src/`
- Contains: Pages, feature components, shadcn-style UI primitives, client API wrappers
- Depends on: REST JSON under `/api/*` (proxied in dev)
- Used by: Browsers on the LAN

**HTTP / Application (Server routes):**
- Purpose: Auth, validation, HTTP status mapping, multipart uploads
- Location: `apps/server/src/routes/api/`
- Contains: `auth/`, `admin/`, `student/` route modules
- Depends on: `lib/*`, `plugins/*`, Prisma
- Used by: Web client and health probes

**Domain (Server lib):**
- Purpose: Business rules, transactions, scoring, workbook parsing
- Location: `apps/server/src/lib/{exam,qbank,roster,auth,student-auth,errors,reply}.ts`
- Contains: Pure(ish) functions and error types; minimal Fastify types except where needed
- Depends on: Prisma, ExcelJS (via qbank/roster parsers)
- Used by: Route handlers

**Infrastructure:**
- Purpose: DB client, env port helper, repo root for templates
- Location: `apps/server/src/lib/prisma.ts`, `apps/server/src/lib/env.ts`, `apps/server/src/lib/repo-root.ts`
- Depends on: `DATABASE_URL`, Prisma schema at repo root
- Used by: All server layers

**Data:**
- Purpose: Canonical schema and migrations
- Location: `prisma/schema.prisma`, `prisma/migrations/`
- Contains: Teachers, import batches, exams, drafts, submissions
- Used by: Server via `@prisma/client` (generated at repo root `postinstall`)

## Data Flow

### Primary Request Path (authenticated API)

1. Browser calls `fetch('/api/...', { credentials: 'include' })` — `apps/web/src/lib/api.ts`
2. Vite dev proxy forwards `/api` to Fastify (`apps/web/vite.config.ts`); production uses external proxy per `docs/DEPLOY.md`
3. `sessionPlugin` attaches `express-session` middleware (`apps/server/src/plugins/session.ts`)
4. Route `preHandler` runs (`requireAdminSession` or `requireStudentSession`) when required
5. Handler validates with Zod, reads `getSessionTeacherId` / `getSessionRosterEntryId`, calls `lib/*`
6. Prisma reads/writes PostgreSQL; JSON response with `{ code, message }` or domain payloads

### Teacher Login and Admin Operation

1. `POST /api/auth/login` — validate credentials (argon2), `session.regenerate`, set `teacherId` (`apps/server/src/routes/api/auth/login.ts`)
2. `GET /api/auth/me` — load teacher row for UI (`apps/server/src/routes/api/auth/me.ts`)
3. If `mustChangePassword`, `requireAdminSession` returns 403 `PASSWORD_CHANGE_REQUIRED` (`apps/server/src/plugins/admin-guard.ts`)
4. Admin routes (e.g. `POST /api/admin/questions/import`) use `preHandler: requireAdminSession`, `getSessionTeacherId`, then `lib/qbank/import-questions.ts`

### Student Exam Flow

1. `POST /api/student/verify` — match `RosterEntry` by name + national ID, `establishStudentSession` (`apps/server/src/routes/api/student/verify.ts`)
2. `GET /api/student/exam/status` — discover in-progress exam for student's roster batch
3. `GET /api/student/exam/paper?examId=` — `assertStudentExamAccess(..., 'read')`, return questions without answers (`apps/server/src/routes/api/student/exam-paper.ts`)
4. `PUT /api/student/exam/answers` — upsert `AnswerDraft` rows during exam
5. `POST /api/student/exam/submit` — `submitExam` scores drafts, creates `Submission` + `Answer` (`apps/server/src/lib/exam/submit.ts`)
6. Web: `/` → redirect; `/exam/login` → `/exam/waiting` → `/exam/take` (`apps/web/src/router.tsx`, `StudentRoute.tsx`)

### Exam Lifecycle (Teacher)

1. Create exam linking `questionBatchId` + `rosterBatchId` — `apps/server/src/routes/api/admin/exams-crud.ts`
2. Materialize `ExamQuestion` rows from batch — `apps/server/src/lib/exam/materialize-questions.ts`
3. `POST /api/admin/exams/:id/start` — `startExam` in transaction; enforces DRAFT, questions, roster, no conflicting IN_PROGRESS on same roster batch (`apps/server/src/lib/exam/transition.ts`)
4. `POST /api/admin/exams/:id/end` — transition to ENDED
5. Export submissions — `apps/server/src/lib/exam/export-workbook.ts`, `apps/server/src/routes/api/admin/exams-export.ts`

**State Management:**
- **Server:** PostgreSQL is source of truth; session holds only IDs and display name
- **Web admin:** React context `AuthContext` mirrors `/api/auth/me` (`apps/web/src/contexts/AuthContext.tsx`)
- **Web student:** Per-route `useEffect` calls `studentApi.me()` in `StudentRoute` / `Home`; exam answers held in page state (`apps/web/src/pages/StudentExamTake.tsx`)

## Key Abstractions

**Unified session (`sid`):**
- Purpose: One cookie for teacher and/or student context
- Examples: `apps/server/src/types/session.d.ts`, `apps/server/src/lib/session.ts`
- Pattern: Extend `express-session` `SessionData` with `teacherId`, `studentRosterEntryId`, `studentName`; access via `getRequestSession(request)`

**Import batch:**
- Purpose: Versioned snapshot of imported questions or roster rows
- Examples: `QuestionImportBatch`, `RosterImportBatch` in `prisma/schema.prisma`
- Pattern: Teacher-owned batch → many rows; exams reference batch IDs

**Exam access modes:**
- Purpose: Centralize whether student can read paper, write drafts, or submit
- Examples: `apps/server/src/lib/exam/access.ts` (`read` | `write` | `submit`)
- Pattern: Throws `ExamAccessError` with HTTP status and Chinese user message

**Domain error types:**
- Purpose: Map business failures to HTTP without scattering status logic
- Examples: `ExamTransitionError` (`apps/server/src/lib/exam/types.ts`), `ExamAccessError`, `SubmitExamError`, `QbankTemplateError`
- Pattern: `instanceof` in route catch blocks → `reply.status(err.statusCode).send({ code, message })`

**Route registrar:**
- Purpose: Keep `index.ts` readable and files small
- Examples: `registerStudentRoutes` in `apps/server/src/routes/api/student/index.ts`
- Pattern: `export async function registerXxxRoutes(app: FastifyInstance)` — one file per resource/action group

## Entry Points

**Server process:**
- Location: `apps/server/src/index.ts`
- Triggers: `pnpm dev:server` (tsx watch), `node apps/server/dist/index.js` (production), Docker `scripts/docker-entrypoint.sh`
- Responsibilities: Build Fastify app, register routes, listen on `getApiPort()` from `apps/server/src/lib/env.ts`

**Web SPA:**
- Location: `apps/web/src/main.tsx` → `apps/web/src/router.tsx`
- Triggers: Vite dev server (`pnpm dev:web-only`) or static hosting of `apps/web/dist` (not bundled in current production Docker image)
- Responsibilities: Render React tree, route guards, toast notifications

**Database schema / migrations:**
- Location: `prisma/schema.prisma`, `prisma/migrations/`
- Triggers: `pnpm postinstall` → `prisma generate`; `pnpm db:migrate`; Docker entrypoint `prisma migrate deploy` + seed
- Responsibilities: Tables for teachers, questions, roster, exams, drafts, submissions, session store

**Health check:**
- Location: `GET /health` in `apps/server/src/index.ts`
- Triggers: Load balancers, `curl` in deploy docs
- Responsibilities: `SELECT 1` via Prisma, return `{ status: 'ok' }`

## Architectural Constraints

- **Threading:** Single Node.js event loop per API process; concurrency via async I/O and Prisma transactions (`$transaction`).
- **Global state:** Prisma client singleton on `globalThis` in development (`apps/server/src/lib/prisma.ts`); no shared mutable app state beyond session store.
- **Session store:** Requires `DATABASE_URL`; `connect-pg-simple` creates `session` table if missing (`apps/server/src/plugins/session.ts`).
- **Production Docker:** Current `Dockerfile` ships **API only** (`apps/server/dist`); web is built in a stage but not copied to the runtime image — front-end in production expects separate hosting or proxy (documented in `docs/DEPLOY.md`).
- **LAN / HTTP:** Designed for classroom intranet HTTP; `SESSION_SECRET` and `TRUST_PROXY` enforced for production cookie security.
- **Teacher ownership:** Admin exam mutations check `exam.teacherId === getSessionTeacherId(request)` inside domain functions (404 on mismatch to avoid leaking existence).

## Anti-Patterns

### Business logic in route handlers

**What happens:** Large handlers with inline Prisma queries and branching instead of `lib/exam/*` helpers.

**Why it's wrong:** Duplicates access rules (roster batch match, exam status) and makes testing harder; exam scoring already lives in `lib/exam/submit.ts` and `score-question.ts`.

**Do this instead:** Add or extend functions under `apps/server/src/lib/<domain>/` and keep routes to Zod + session ID + `reply.send`.

### Bypassing `requireAdminSession` / `assertStudentExamAccess`

**What happens:** New student endpoints that only check session presence but not roster batch or exam status.

**Why it's wrong:** Students could access exams they are not rostered for or submit after exam ended.

**Do this instead:** Use `requireStudentSession` preHandler and `assertStudentExamAccess` with the correct mode (`apps/server/src/lib/exam/access.ts`).

### Split session cookies for teacher vs student

**What happens:** Introducing a second cookie name for students.

**Why it's wrong:** Breaks proctor flow where teacher session is preserved when verifying a student (`establishStudentSession` in `apps/server/src/lib/student-auth.ts` skips regenerate if `teacherId` already set).

**Do this instead:** Continue extending `SessionData` in `apps/server/src/types/session.d.ts` and use `destroyStudentSession` for student-only logout.

## Error Handling

**Strategy:** HTTP status + JSON body with `code` and `message` (or `error` for generic 401); constants for auth messages in `apps/server/src/lib/errors.ts`.

**Patterns:**
- Validation failures: 400 + `VALIDATION_ERROR` from Zod `safeParse` in routes
- Auth: 401 `{ error: 'Unauthorized' }` via `replyUnauthorized` (`apps/server/src/lib/reply.ts`)
- Domain: catch `ExamTransitionError` / `ExamAccessError` / `SubmitExamError` and map to status
- Web client: `ApiError` in `apps/web/src/lib/api.ts`; 401 triggers toast + session handler; 403 `PASSWORD_CHANGE_REQUIRED` redirects to change-password

## Cross-Cutting Concerns

**Logging:** Fastify built-in logger (`logger: true` in `apps/server/src/index.ts`); structured events on student verify success/failure.

**Validation:** Zod schemas colocated in route files; national ID format in `apps/server/src/lib/roster/national-id.ts`.

**Authentication:** Argon2 password hashes for teachers (`apps/server/src/routes/api/auth/login.ts`); students authenticate by roster identity only (no password).

**Rate limiting:** Per-route via `@fastify/rate-limit` `config.rateLimit` on login, student verify, and imports (env-tunable max per minute).

---

*Architecture analysis: 2026-05-17*

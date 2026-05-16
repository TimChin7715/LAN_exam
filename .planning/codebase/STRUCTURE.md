# Codebase Structure

**Analysis Date:** 2026-05-17

## Directory Layout

```
LAN_exam/
├── apps/
│   ├── server/                 # @lan-exam/server — Fastify API
│   │   └── src/
│   │       ├── index.ts        # Process entry, route registration
│   │       ├── plugins/        # Fastify plugins (session, guards)
│   │       ├── routes/api/     # HTTP handlers by audience
│   │       ├── lib/            # Domain + infrastructure helpers
│   │       └── types/          # Session & Fastify augmentations
│   └── web/                    # @lan-exam/web — Vite + React SPA
│       └── src/
│           ├── main.tsx        # React bootstrap
│           ├── router.tsx      # react-router-dom routes
│           ├── pages/          # Route-level screens
│           ├── components/     # UI + feature components
│           ├── contexts/       # React context (admin auth)
│           ├── lib/            # API clients & shared helpers
│           └── plugins/        # Vite-only plugins
├── prisma/                     # Schema, migrations, seed (repo root)
├── docs/                       # DEPLOY.md, XLSX templates, fixtures
├── scripts/                    # docker-entrypoint.sh
├── .planning/                  # GSD planning artifacts (not runtime)
├── package.json                # Workspace root scripts, prisma deps
├── pnpm-workspace.yaml         # apps/*
├── docker-compose.yml          # db + app services
├── Dockerfile                  # Multi-stage API production image
└── .env                        # Local env (exists; do not commit secrets)
```

## Directory Purposes

**`apps/server/`:**
- Purpose: Backend API for auth, imports, exams, student taking
- Contains: TypeScript ESM, compiles to `apps/server/dist/`
- Key files: `src/index.ts`, `src/routes/api/**`, `src/lib/**`

**`apps/web/`:**
- Purpose: Browser UI for teachers and students
- Contains: React 19 pages, Tailwind 4, shadcn-style `components/ui/`
- Key files: `src/router.tsx`, `src/lib/api.ts`, `vite.config.ts`

**`prisma/`:**
- Purpose: Database schema and migrations shared by the monorepo
- Contains: `schema.prisma`, `migrations/`, `seed.ts`
- Key files: `schema.prisma` (models: Teacher, Question, RosterEntry, Exam, Submission, AnswerDraft)

**`docs/`:**
- Purpose: Deployment guide and downloadable Excel templates
- Contains: `DEPLOY.md`, `templates/*.xlsx`, `fixtures/import-test/`
- Key files: Used by admin template download routes via `getRepoRoot()`

**`scripts/`:**
- Purpose: Container startup (migrate, seed, run API)
- Contains: `docker-entrypoint.sh`

**`.planning/`:**
- Purpose: GSD phase plans, codebase maps, state
- Contains: `codebase/`, `phases/`, `STATE.md`
- Generated: No — committed planning docs

## Key File Locations

**Entry Points:**
- `apps/server/src/index.ts`: Fastify server bootstrap and route wiring
- `apps/web/src/main.tsx`: React `createRoot`, `AuthProvider`, `AppRouter`
- `apps/web/index.html`: Vite HTML shell (sibling of `src/`)
- `prisma/seed.ts`: Seed teacher account (invoked by `pnpm db:seed` / Docker)

**Configuration:**
- `package.json` (root): `dev`, `build`, `db:migrate`, `postinstall` → prisma generate
- `apps/server/package.json`: `dev` uses `tsx watch` with `../../.env`
- `apps/web/vite.config.ts`: `@/` alias, `/api` proxy, `api-health-check` plugin
- `apps/server/tsconfig.json`: `NodeNext`, `outDir: dist`
- `apps/web/tsconfig.app.json` / `tsconfig.node.json`: project references
- `docker-compose.yml`: Postgres + API service ports and env keys (not values)
- `.env` / `.env.example` (root): `API_PORT`, `WEB_PORT`, `DATABASE_URL`, session vars — **never read secrets into docs**

**Core Logic:**
- `apps/server/src/lib/exam/`: Exam lifecycle, access, submit, scoring, export
- `apps/server/src/lib/qbank/`: Question workbook parse/import
- `apps/server/src/lib/roster/`: Roster workbook parse/import, national ID validation
- `apps/server/src/lib/auth.ts` / `student-auth.ts`: Session identity helpers
- `apps/web/src/lib/api.ts`: Admin `apiFetch` + `authApi`
- `apps/web/src/lib/student.ts`, `exam.ts`, `qbank.ts`, `roster.ts`: Typed client APIs per domain

**HTTP Routes (by prefix):**
- `apps/server/src/routes/api/auth/`: `/api/auth/login|logout|me|change-password`
- `apps/server/src/routes/api/admin/`: `/api/admin/questions/*`, `roster/*`, `exams/*`, `ping`
- `apps/server/src/routes/api/student/`: `/api/student/verify`, `exam/*`, `me`, `logout`

**Testing:**
- `apps/server/src/lib/exam/score-question.test.ts`: Node test for scoring
- `apps/server/src/lib/roster/national-id.test.ts`: National ID validation tests
- No root `vitest`/`jest` config — co-located `*.test.ts` next to server lib files

## Naming Conventions

**Files:**
- Route modules: kebab-case resource + action — `exams-lifecycle.ts`, `questions-import.ts`
- Route exports: `registerAdminExamsLifecycleRoutes`, `registerStudentVerifyRoutes`
- Domain modules: kebab-case — `parse-workbook.ts`, `import-questions.ts`, `mask-national-id.ts`
- Domain errors/types: `types.ts` per folder (`lib/exam/types.ts`, `lib/qbank/types.ts`)
- React pages: PascalCase default export — `AdminExams.tsx`, `StudentExamTake.tsx`
- React components: PascalCase file and export — `ImportDropzone.tsx`
- UI primitives: lowercase kebab under `components/ui/` — `alert-dialog.tsx`
- Tests: `*.test.ts` beside implementation

**Directories:**
- API routes grouped by audience: `routes/api/{auth,admin,student}/`
- Server domain by bounded context: `lib/{exam,qbank,roster}/`
- Web features: `components/admin/{qbank,roster}/`, pages at `pages/` root
- Path alias `@/` → `apps/web/src/` (see `apps/web/tsconfig.json`)

**Symbols:**
- Functions: camelCase — `assertStudentExamAccess`, `registerAuthRoutes`
- React components: PascalCase — `StudentRoute`, `AdminLayout`
- Prisma models/enums: PascalCase models, SCREAMING_SNAKE enums — `ExamStatus`, `QuestionType`
- API JSON codes: SCREAMING_SNAKE — `PASSWORD_CHANGE_REQUIRED`, `ALREADY_SUBMITTED`

## Where to Add New Code

**New admin API endpoint:**
- Route handler: `apps/server/src/routes/api/admin/<resource>-<action>.ts`
- Export `registerAdmin*Routes` and import it in `apps/server/src/index.ts`
- Use `preHandler: requireAdminSession` and `getSessionTeacherId(request)`
- Business logic: `apps/server/src/lib/<domain>/`

**New student API endpoint:**
- Route: `apps/server/src/routes/api/student/<name>.ts`
- Register in `apps/server/src/routes/api/student/index.ts`
- Use `requireStudentSession` and exam access helpers when exam-scoped

**New auth/session field:**
- Extend `SessionData` in `apps/server/src/types/session.d.ts`
- Read/write via `getRequestSession` / `saveSession` in `apps/server/src/lib/session.ts`

**New Prisma model or field:**
- Edit `prisma/schema.prisma`, add migration under `prisma/migrations/`
- Run `pnpm db:migrate` (or deploy via Docker entrypoint)

**New admin UI page:**
- Page: `apps/web/src/pages/Admin<Name>.tsx`
- Route: add under `RequireAuthenticatedAdmin` + `AdminLayout` in `apps/web/src/router.tsx`
- Nav link: `apps/web/src/components/admin/AdminLayout.tsx`
- API calls: extend `apps/web/src/lib/*.ts` or add domain client module

**New student UI screen:**
- Page: `apps/web/src/pages/Student<Name>.tsx` or `Exam*.tsx`
- Route: nest under `<Route path="/exam" element={<StudentRoute />}>` in `router.tsx`
- API: `apps/web/src/lib/student.ts` or `exam.ts`

**New Excel import type:**
- Mirror qbank/roster: `lib/<domain>/parse-workbook.ts`, `validate-rows.ts`, `import-*.ts`, admin import route with `multipart` and `assertValidXlsxUpload` pattern from `apps/server/src/lib/qbank/xlsx-file.ts`

**Shared UI component:**
- Reusable primitive: `apps/web/src/components/ui/<component>.tsx` (shadcn pattern)
- Feature-specific: `apps/web/src/components/admin/<area>/` or `components/auth/`

**Utilities:**
- Server-only: `apps/server/src/lib/<name>.ts`
- Web-only: `apps/web/src/lib/<name>.ts` (use `@/lib/...` imports)
- Cross-package shared types: prefer duplicating small DTO types in web `lib/*.ts` matching API responses (no shared package today)

## Special Directories

**`apps/server/dist/`:**
- Purpose: Compiled JavaScript output from `tsc`
- Generated: Yes (`pnpm --filter @lan-exam/server build`)
- Committed: No

**`apps/web/dist/`:**
- Purpose: Vite production static assets
- Generated: Yes (`pnpm --filter @lan-exam/web build`)
- Committed: No

**`node_modules/`:**
- Purpose: pnpm workspace dependencies (hoisted at root)
- Generated: Yes (`pnpm install`)
- Committed: No

**`prisma/migrations/`:**
- Purpose: SQL migration history
- Generated: By `prisma migrate`
- Committed: Yes

**`docs/templates/`:**
- Purpose: Canonical XLSX templates served to admins
- Generated: No
- Committed: Yes — copied into Docker image at `docs/templates`

**`.cursor/`:**
- Purpose: GSD tooling, agents, skills (IDE/agent config)
- Committed: Often untracked locally; not part of runtime app

## Web Route Map

| Path | Page file | Guard |
|------|-----------|--------|
| `/` | `pages/Home.tsx` | Redirect by student session |
| `/exam/login` | `pages/StudentLogin.tsx` | `StudentRoute` |
| `/exam/waiting` | `pages/StudentWaiting.tsx` | `StudentRoute` |
| `/exam/take` | `pages/StudentExamTake.tsx` | `StudentRoute` |
| `/admin/login` | `pages/AdminLogin.tsx` | `AdminRoute` |
| `/admin/change-password` | `pages/AdminChangePassword.tsx` | `RequireChangePassword` |
| `/admin`, `/admin/dashboard` | `pages/AdminDashboard.tsx` | `RequireAuthenticatedAdmin` + layout |
| `/admin/questions` | `pages/AdminQuestions.tsx` | same |
| `/admin/roster` | `pages/AdminRoster.tsx` | same |
| `/admin/exams` | `pages/AdminExams.tsx` | same |
| `/admin/exams/:examId` | `pages/AdminExamDetail.tsx` | same |

## API Route Map (representative)

| Method | Path | Route file |
|--------|------|------------|
| GET | `/health` | `apps/server/src/index.ts` |
| POST | `/api/auth/login` | `routes/api/auth/login.ts` |
| GET | `/api/auth/me` | `routes/api/auth/me.ts` |
| POST | `/api/student/verify` | `routes/api/student/verify.ts` |
| GET | `/api/student/exam/paper` | `routes/api/student/exam-paper.ts` |
| POST | `/api/admin/questions/import` | `routes/api/admin/questions-import.ts` |
| POST | `/api/admin/roster/import` | `routes/api/admin/roster-import.ts` |
| POST | `/api/admin/exams/:id/start` | `routes/api/admin/exams-lifecycle.ts` |
| GET | `/api/admin/exams/:id/export` | `routes/api/admin/exams-export.ts` |

---

*Structure analysis: 2026-05-17*

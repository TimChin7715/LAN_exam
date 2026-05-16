# Technology Stack

**Analysis Date:** 2026-05-17

## Languages

**Primary:**
- **TypeScript** 5.9.x (lockfile) / `^5.8.3` (manifest) — All application code in `apps/server/src/` and `apps/web/src/`
- **SQL** — Prisma migrations under `prisma/migrations/`

**Secondary:**
- **Shell** — `scripts/docker-entrypoint.sh` for container startup
- **JavaScript (ESM)** — Ad-hoc scripts in `apps/server/scripts/` (e.g. `generate-import-test-files.mjs`)

## Runtime

**Environment:**
- **Node.js** 22 (`node:22-bookworm-slim` in `Dockerfile`; README requires Node.js 20+ for local pnpm)
- **ES modules** — `"type": "module"` in `apps/server/package.json` and `apps/web/package.json`; server compiles with `"module": "NodeNext"`

**Package Manager:**
- **pnpm** 9.15.9 (`packageManager` in root `package.json`; Corepack in `Dockerfile`)
- Lockfile: **present** — `pnpm-lock.yaml` at repo root
- Workspace: `pnpm-workspace.yaml` with `packages: ['apps/*']`

## Frameworks

**Core:**
- **Fastify** 5.8.x — HTTP API in `apps/server/src/index.ts`
- **React** 19.2.x — SPA in `apps/web/src/`
- **React Router DOM** 7.15.x — Client routing in `apps/web/src/router.tsx`
- **Vite** 6.4.x — Web dev server and production build (`apps/web/vite.config.ts`)

**Data / ORM:**
- **Prisma** 6.19.x — Schema at `prisma/schema.prisma`; client generated at repo root (`postinstall`: `prisma generate`)

**UI:**
- **Tailwind CSS** 4.1.x via `@tailwindcss/vite` — Styling in `apps/web/src/index.css`, `globals.css`
- **Radix UI** + **shadcn/ui** pattern — `apps/web/components.json` (style: `new-york`); primitives under `apps/web/src/components/ui/`
- **react-hook-form** + **Zod** 4.x — Forms and validation on web and server

**Testing:**
- **Not configured** — No Jest/Vitest config at repo root; two ad-hoc `node:test` files under `apps/server/src/lib/**/*.test.ts` only

**Build/Dev:**
- **tsx** 4.22.x — Server dev (`tsx watch --env-file=../../.env`) and Prisma seed (`tsx prisma/seed.ts`)
- **TypeScript compiler** — `tsc` for server (`apps/server/tsconfig.json`) and web (`tsc -b` in web build script)

## Key Dependencies

**Critical (server — `apps/server/package.json`):**
- `@prisma/client` ^6.8.2 — All persistence
- `fastify` ^5.3.3 — API framework
- `argon2` ^0.43.0 — Teacher password hash/verify (`apps/server/src/routes/api/auth/login.ts`, `change-password.ts`)
- `express-session` + `connect-pg-simple` + `pg` — Cookie sessions stored in PostgreSQL (`apps/server/src/plugins/session.ts`)
- `@fastify/multipart` — Excel import uploads
- `@fastify/rate-limit` — Per-route throttling (login, imports, student verify)
- `exceljs` ^4.4.0 — Parse/generate `.xlsx` for question bank, roster, exam export (`apps/server/src/lib/qbank/`, `roster/`, `exam/export-workbook.ts`)
- `zod` ^4.4.3 — Request body validation on API routes

**Critical (web — `apps/web/package.json`):**
- `react` / `react-dom` ^19.1.0
- `react-router-dom` ^7.15.1
- `sonner` — Toast notifications (`apps/web/src/main.tsx`)
- `lucide-react` — Icons (shadcn config)

**Infrastructure (root `package.json`):**
- `prisma` (dev) — CLI migrations and generate
- `@prisma/client` — Shared generated client for seed and server

## Configuration

**Environment:**
- Root **`.env`** file present (local secrets; do not commit)
- **`.env.example`** at repo root documents variable names for local/pnpm dev
- Server dev loads env via `tsx watch --env-file=../../.env` (`apps/server/package.json`)
- Vite loads env from monorepo root: `envDir: rootDir` in `apps/web/vite.config.ts` (`loadEnv(mode, rootDir, '')`)

**Key configs required (by code):**
| Variable | Required when | Used in |
|----------|---------------|---------|
| `DATABASE_URL` | Always (server start) | Prisma, session store |
| `SESSION_SECRET` | Production (min 16 chars) | `apps/server/src/plugins/session.ts` |
| `SEED_ADMIN_PASSWORD` | `prisma db seed`, Docker first boot | `prisma/seed.ts`, `scripts/docker-entrypoint.sh` |
| `API_PORT` / `PORT` | Optional (default `3101`) | `apps/server/src/lib/env.ts`, Vite proxy |
| `WEB_PORT` | Optional (default `5180`) | `apps/web/vite.config.ts` |
| `HOST` | Optional (`0.0.0.0`) | `apps/server/src/index.ts` |
| `NODE_ENV` | Production behavior | Session secret, cookie `secure`, Prisma logging |
| `TRUST_PROXY` | Production behind proxy | `trustProxy`, secure cookies |
| `SESSION_MAX_AGE_MS` | Optional (default 24h) | Session cookie TTL |
| `LOGIN_RATE_LIMIT_MAX` | Optional (default 15/min) | `apps/server/src/routes/api/auth/login.ts` |
| `IMPORT_RATE_LIMIT_MAX` | Optional (default 10/min) | `apps/server/src/routes/api/admin/questions-import.ts` |
| `ROSTER_IMPORT_RATE_LIMIT_MAX` | Optional (default 10/min) | `apps/server/src/routes/api/admin/roster-import.ts` |
| `STUDENT_VERIFY_RATE_LIMIT_MAX` | Optional (default 20/min) | `apps/server/src/routes/api/student/verify.ts` |

**Build:**
- `apps/server/tsconfig.json` — `outDir: dist`, `strict: true`, `NodeNext` modules
- `apps/web/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — Project references for Vite app
- `prisma/schema.prisma` — PostgreSQL datasource
- `docker-compose.yml` — Postgres 16 + app service
- `Dockerfile` — Multi-stage: deps → build (web + server) → production image (API only in entrypoint)

**Linting/formatting:**
- Not detected — No ESLint, Prettier, or Biome config in application packages

## Platform Requirements

**Development:**
- Node.js 20+ and pnpm 9+ (per `README.md`)
- Docker + Compose v2 recommended (`docker compose up --build`)
- PostgreSQL 16 via Compose on host `127.0.0.1:5434` → container `5432` (`docker-compose.yml`)
- Parallel dev: `pnpm dev` runs `@lan-exam/server` and `@lan-exam/web` (`package.json` root script)

**Production:**
- **Docker** on classroom LAN server — single `app` container exposes API port **3101** (`Dockerfile`, `docker-compose.yml`)
- **HTTP** on intranet by default; TLS optional at reverse proxy (`docs/DEPLOY.md`)
- Production image entrypoint: migrate → seed → `node apps/server/dist/index.js` (`scripts/docker-entrypoint.sh`)
- Web production build runs in Docker build stage but **is not served by the API process** in the current entrypoint (no `@fastify/static` in server); LAN clients may use separate Web hosting or future static integration

**Ports (defaults):**
| Service | Port | Config |
|---------|------|--------|
| API | 3101 | `API_PORT` / `PORT` |
| Web (Vite dev) | 5180 | `WEB_PORT` |
| Postgres (host map) | 5434 | `docker-compose.yml` |

---

*Stack analysis: 2026-05-17*

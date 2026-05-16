# Coding Conventions

**Analysis Date:** 2026-05-17

## Naming Patterns

**Files:**
- **Server routes:** kebab-case file names matching the resource, e.g. `apps/server/src/routes/api/admin/questions-import.ts`, `apps/server/src/routes/api/student/exam-submit.ts`.
- **Server domain libs:** kebab-case under feature folders, e.g. `apps/server/src/lib/qbank/validate-rows.ts`, `apps/server/src/lib/exam/score-question.ts`.
- **Server tests:** co-located `*.test.ts` next to the module under test, e.g. `apps/server/src/lib/roster/national-id.test.ts`.
- **Web pages:** PascalCase default-export components, e.g. `apps/web/src/pages/AdminLogin.tsx`, `apps/web/src/pages/StudentExamTake.tsx`.
- **Web components:** PascalCase under feature or `ui/`, e.g. `apps/web/src/components/admin/qbank/ImportDropzone.tsx`, `apps/web/src/components/ui/button.tsx`.
- **Web lib modules:** kebab-case or single-word domain files, e.g. `apps/web/src/lib/api.ts`, `apps/web/src/lib/national-id.ts`.

**Functions:**
- Use **camelCase** for functions and handlers: `registerAuthLoginRoutes`, `scoreQuestion`, `isValidNationalIdFormat`, `onSubmit`.
- Route registrars follow **`register{Area}{Resource}Routes`**: `registerAdminQuestionsImportRoutes`, `registerStudentExamSubmitRoutes` in `apps/server/src/routes/api/**`.
- Fastify **preHandlers** use **`require{Role}Session`**: `requireAdminSession` (`apps/server/src/plugins/admin-guard.ts`), `requireStudentSession` (`apps/server/src/plugins/student-guard.ts`).

**Variables:**
- camelCase for locals and parameters; `const` by default.
- Destructured request bodies from Zod: `const { username, password } = parsed.data`.
- Session IDs from helpers: `teacherId`, `rosterEntryId` via `getSessionTeacherId` / `getSessionRosterEntryId`.

**Types:**
- PascalCase for types, interfaces, and classes: `ScoreableQuestion`, `ApiError`, `ExamAccessError`, `AuthUser`.
- Zod-inferred form types: `type LoginValues = z.infer<typeof loginSchema>` in page files.
- Prisma enums re-used on the wire where aligned: `QuestionType`, `MultiScoringRule` from `@prisma/client` on the server; mirrored string unions on the web when needed (e.g. `ExamPaperItem.type` in `apps/web/src/lib/student.ts`).

**Constants:**
- UPPER_SNAKE_CASE for error codes and shared messages in dedicated modules:
  - Server: `apps/server/src/lib/errors.ts` (`INVALID_CREDENTIALS_CODE`, `AUTH_ERROR_MESSAGE`).
  - Web: `apps/web/src/lib/student.ts` (`STUDENT_AUTH_ERROR_MESSAGE`), page-local duplicates only when matching server copy (e.g. `INVALID_CREDENTIALS_MESSAGE` in `AdminLogin.tsx`).

## Code Style

**Formatting:**
- No ESLint, Prettier, Biome, or EditorConfig detected at repo root or under `apps/`.
- Rely on **TypeScript strict mode** and consistent manual style observed in existing files.
- **Server:** double quotes appear in some files, single in others; match the file you edit. Prefer trailing commas in multi-line objects/arrays (see `apps/server/src/routes/api/auth/login.ts`).
- **Web:** single quotes in TSX/TS; semicolons used throughout `apps/web/src/`.

**TypeScript:**
- **Server** (`apps/server/tsconfig.json`): `strict: true`, `module`/`moduleResolution`: `NodeNext`, `rootDir`: `src`, `outDir`: `dist`. Use **`.js` extensions in relative imports** (Node ESM), e.g. `from '../../../lib/prisma.js'`.
- **Web** (`apps/web/tsconfig.app.json`): `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `jsx`: `react-jsx`. Use path alias **`@/*`** → `apps/web/src/*` (also in `apps/web/components.json`).

**Linting:**
- Not detected. Before claiming “lint-clean,” run `pnpm -r build` as the primary static check.

## Import Organization

**Server (`apps/server/src/`):**
1. External packages (`fastify`, `zod`, `argon2`, `@prisma/client`).
2. Blank line (optional).
3. Relative imports from `lib/`, `plugins/`, sibling routes — **always with `.js` suffix**.

**Web (`apps/web/src/`):**
1. React / router / third-party (`react`, `react-router-dom`, `zod`, `lucide-react`).
2. `@/components/...`
3. `@/contexts/...` or `@/lib/...`
4. Relative imports for co-located assets (e.g. `./globals.css` in `main.tsx`).

**Path aliases:**
- Web only: `@/` → `apps/web/src/` (Vite `resolve.alias` in `apps/web/vite.config.ts`, TS `paths` in `apps/web/tsconfig.app.json`).

## Error Handling

**API validation (server):**
- Define **Zod schemas** beside the route (e.g. `loginBodySchema` in `apps/server/src/routes/api/auth/login.ts`, `submitBodySchema` in `exam-submit.ts`).
- On failure: `safeParse` → `400` with `{ code: 'VALIDATION_ERROR', message?: string, error?: string }` — match neighboring routes in the same area.

**Domain errors (server):**
- Throw small **Error subclasses** with `statusCode` and `code`: `ExamAccessError`, `ExamTransitionError`, `SubmitExamError` in `apps/server/src/lib/exam/types.ts`; `QbankTemplateError` in `apps/server/src/lib/qbank/types.ts`.
- Route handlers **catch instanceof** and map to HTTP: see `apps/server/src/routes/api/student/exam-submit.ts` (`SubmitExamError` → `reply.status(err.statusCode).send({ code, message })`).
- Unhandled errors: rethrow so Fastify logger handles them.

**Auth responses (server):**
- Use `replyUnauthorized` from `apps/server/src/lib/reply.ts` for 401 in guards; check `isReplyFinished` before sending.
- Business auth failures: `401` + `{ code, message }` with constants from `apps/server/src/lib/errors.ts` (never leak which field failed).
- Forced password change: `403` + `code: 'PASSWORD_CHANGE_REQUIRED'` (`apps/server/src/plugins/admin-guard.ts`).

**Client API (web):**
- Centralize fetch in `apiFetch` / `handleAuthResponse` in `apps/web/src/lib/api.ts`.
- Throw **`ApiError`** with `status` and optional `code`; pages catch and set form-level error or rely on toast for session expiry.
- Map known codes in UI (e.g. `INVALID_CREDENTIALS` on login pages) using the same Chinese user strings as the server where applicable.

## Logging

**Server:**
- Fastify built-in logger: `logger: true` in `apps/server/src/index.ts`.
- Structured events: `request.log.info` / `request.log.warn` with `event` field (`auth_login_success`, `auth_login_failed` in `login.ts`).
- Prisma: `log: ['error', 'warn']` in development via `apps/server/src/lib/prisma.ts`.

**Web:**
- No logging framework. Use **`toast` from `sonner`** for user-visible errors (`apps/web/src/main.tsx` mounts `<Toaster />`; `api.ts` toasts on 401).
- Avoid `console.log` in committed page code unless debugging locally.

## Comments

**When to comment:**
- Brief **file-level or export-level** comments only for non-obvious behavior (e.g. `apps/server/src/lib/reply.ts` on `isReplyFinished`).
- Prisma schema: use `///` doc comments on models when documenting domain rules (`prisma/schema.prisma`).
- Prefer self-explanatory names over narrating what the code does.

**JSDoc/TSDoc:**
- Rare; one-line `/** ... */` above small helpers is acceptable (`apps/server/src/lib/reply.ts`, `apps/web/src/lib/api.ts` on `handleAuthResponse`).
- Do not add JSDoc to every function.

## Function Design

**Size:**
- Keep route handlers thin: parse → call `lib/` → map response. Heavy logic belongs in `apps/server/src/lib/{qbank,exam,roster}/`.
- Web pages: extract repeated UI into `apps/web/src/components/admin/**` (import flows mirror qbank vs roster).

**Parameters:**
- Prefer explicit objects for domain operations (e.g. `submitExam(prisma, { examId, rosterEntryId })`).
- Use non-null assertion on session IDs only **after** `preHandler` guarantees (`getSessionTeacherId(request)!`).

**Return values:**
- HTTP handlers return `reply.send(...)` or `reply.status(n).send(...)`.
- Pure functions return typed results (`ScoreResult`, validation `{ ok, errors }` patterns in qbank/roster libs).

## Module Design

**Exports:**
- **Named exports** for libraries, guards, registrars, and components (except **default export** for page components).
- Barrel `index.ts` for route groups: `apps/server/src/routes/api/auth/index.ts` re-exports registrars only.

**Barrel files:**
- Use sparingly at route `index.ts` level; **no** deep barrel re-exports for `lib/` — import the specific module.

**Monorepo boundaries:**
- **Do not** import server code into web or vice versa. Duplicate tiny pure helpers only when necessary (e.g. `isValidNationalIdFormat` in both `apps/server/src/lib/roster/national-id.ts` and `apps/web/src/lib/national-id.ts` — keep in sync or extract shared package if duplication grows).

## Server Route Pattern

Use this shape for new endpoints:

```typescript
// apps/server/src/routes/api/{area}/{resource}.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

const bodySchema = z.object({ /* fields */ });

export async function registerAdminExampleRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/api/admin/example',
    {
      preHandler: requireAdminSession,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ code: 'VALIDATION_ERROR', message: '请求参数无效' });
      }
      // ...
      return reply.send({ ok: true });
    },
  );
}
```

Register the route in `apps/server/src/index.ts` alongside existing `register*` calls.

## Web UI Pattern

- **Forms:** `react-hook-form` + `zodResolver` + shadcn `Form*` components (`apps/web/src/pages/AdminLogin.tsx`).
- **Layout:** admin shell via `AdminLayout` + nested routes in `apps/web/src/router.tsx`.
- **Auth gates:** layout routes `AdminRoute`, `StudentRoute`, `RequireAuthenticatedAdmin` in `apps/web/src/components/auth/`.
- **Styling:** Tailwind utility classes; merge with `cn()` from `apps/web/src/lib/utils.ts`; variants via `class-variance-authority` in UI primitives (`button.tsx`).
- **User-facing copy:** Simplified Chinese strings inline in JSX or shared constants in `lib/` — keep admin and student messaging consistent with server `message` fields.

## API Response Shapes

| Situation | Shape | Example file |
|-----------|--------|----------------|
| Success (JSON) | Domain object or `{ ok: true, ... }` | `login.ts`, `exam-submit.ts` |
| Validation | `{ code: 'VALIDATION_ERROR', message }` | `exam-submit.ts` |
| Row-level import errors | `{ ok: false, errors: RowError[] }` | `questions-import.ts` |
| Unauthorized | `{ error: 'Unauthorized' }` or `{ code, message }` | `reply.ts`, `login.ts` |
| Domain failure | `{ code, message }` + appropriate status | `SubmitExamError` handling |

**Web client:** expect JSON bodies; read `message` or `error` in `apiFetch` (`apps/web/src/lib/api.ts`).

---

*Convention analysis: 2026-05-17*

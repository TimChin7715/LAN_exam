# Codebase Concerns

**Analysis Date:** 2026-05-17

## Tech Debt

**Production web delivery not integrated in Docker image:**
- Issue: `Dockerfile` production stage runs only `apps/server/dist/index.js`; `apps/web` is built in the `build` stage but not copied into the runtime image. `docker-compose.yml` exposes only port `3101` (API). Deployment docs (`docs/DEPLOY.md`) defer “正式 Web 前端上线” to a separate port or reverse proxy.
- Files: `Dockerfile`, `docker-compose.yml`, `docs/DEPLOY.md`
- Impact: Operators may assume `docker compose up` serves the full exam UI; browsers hitting `:3101` get API/health only unless static assets are deployed separately.
- Fix approach: Add a multi-stage target that serves `apps/web/dist` via Nginx/Caddy in Compose, or document a required second service with a checked-in `docker-compose.web.yml` example.

**Minimal automated test surface:**
- Issue: Only two unit test modules use Node’s built-in `node:test`; no Vitest/Jest config, no API integration tests, no Playwright/Cypress E2E, no GitHub Actions (or other) CI workflow in the repo.
- Files: `apps/server/src/lib/exam/score-question.test.ts`, `apps/server/src/lib/roster/national-id.test.ts`
- Impact: Regressions in import pipelines, exam lifecycle, session auth, and concurrent submit paths are caught only manually.
- Fix approach: Add `pnpm test` at root; start with route-level tests for `submitExam`, `assertStudentExamAccess`, and import validators; add a smoke CI job on push.

**No ESLint/Prettier/Biome in application packages:**
- Issue: Root and `apps/*` have no lint/format config; conventions are implicit from existing code only.
- Files: `apps/server/package.json`, `apps/web/package.json`
- Impact: Inconsistent style and missed static checks (unused imports, hook deps) as the team grows.
- Fix approach: Add shared ESLint + TypeScript-eslint for both apps; wire `pnpm lint` in CI.

**Docker seed resets admin password on every container start:**
- Issue: `scripts/docker-entrypoint.sh` always runs `prisma db seed`; `prisma/seed.ts` `upsert` **update** branch always sets `passwordHash` from `SEED_ADMIN_PASSWORD` and `mustChangePassword: true`.
- Files: `scripts/docker-entrypoint.sh`, `prisma/seed.ts`
- Impact: Redeploying the `app` container overwrites the seeded teacher password and forces password-change flow again, surprising operators who already changed credentials.
- Fix approach: Seed only when no `Teacher` row exists, or gate seed behind `RUN_SEED_ON_START=true` for first boot only.

**Duplicate masking logic (server vs web):**
- Issue: `maskNationalId` is duplicated with a comment to stay aligned (`apps/server/src/lib/exam/mask-national-id.ts`, `apps/web/src/lib/roster.ts`).
- Files: `apps/server/src/lib/exam/mask-national-id.ts`, `apps/web/src/lib/roster.ts`
- Impact: Export masking and UI masking can drift after one-sided edits.
- Fix approach: Move to a small shared package (e.g. `packages/shared`) or generate from one source.

**v1 teacher model — no RBAC, no teacher admin UI:**
- Issue: Prisma comment on `Teacher` states all teachers are equal; there is no role table, no teacher CRUD API, only seed user `teacher_admin`.
- Files: `prisma/schema.prisma`, `prisma/seed.ts`
- Impact: Multi-instructor deployments cannot provision accounts without direct DB access.
- Fix approach: Planned RBAC phase; until then document single-teacher operational model.

**Excel import stack is monolithic in memory:**
- Issue: Upload handlers call `data.toBuffer()` with no `fileSize` limit on `@fastify/multipart`; entire workbook parsed by ExcelJS in process memory.
- Files: `apps/server/src/index.ts`, `apps/server/src/routes/api/admin/roster-import.ts`, `apps/server/src/routes/api/admin/questions-import.ts`, `apps/server/src/lib/qbank/xlsx-file.ts`
- Impact: Large or malicious uploads can exhaust memory on the API host during a LAN exam.
- Fix approach: Set `limits.fileSize` on multipart; reject over threshold before `toBuffer()`; stream-parse if sizes grow.

**Answer autosave uses per-row upserts in a loop:**
- Issue: `PUT /api/student/exam/answers` runs one `upsert` per distinct question inside a transaction loop.
- Files: `apps/server/src/routes/api/student/exam-answers.ts`
- Impact: High-frequency saves on large papers increase DB round-trips and transaction time.
- Fix approach: Batch with `createMany` + `updateMany` or a single raw `INSERT ... ON CONFLICT` where appropriate.

## Known Bugs

**Concurrent exam submit can surface as 500 instead of 409:**
- Symptoms: Two rapid `POST /api/student/exam/submit` requests may yield an unhandled Prisma unique violation instead of `ALREADY_SUBMITTED`.
- Files: `apps/server/src/lib/exam/submit.ts`, `apps/server/src/routes/api/student/exam-submit.ts`, `prisma/schema.prisma` (`Submission @@unique([examId, rosterEntryId])`)
- Trigger: Double-click submit or retry while the first transaction is in flight; pre-check at lines 15–27 in `submit.ts` is outside the transaction, so both requests can pass before either commits.
- Workaround: Client should disable submit button after success; server should catch `P2002` and map to `409 ALREADY_SUBMITTED`.

**Student exam status uses non-deterministic `findFirst`:**
- Symptoms: If data ever has more than one `IN_PROGRESS` exam for the same `rosterBatchId` (constraint is only enforced at **start** time in `transition.ts`, not globally across batches), `GET /api/student/exam/status` returns an arbitrary exam.
- Files: `apps/server/src/routes/api/student/exam-status.ts`, `apps/server/src/lib/exam/transition.ts`
- Trigger: Manual DB edits or future bugs bypassing `ROSTER_BATCH_BUSY` guard.
- Workaround: Rely on `startExam` conflict check; add DB partial unique index or order `findFirst` by `startedAt desc` explicitly.

## Security Considerations

**Plaintext national ID storage:**
- Risk: `RosterEntry.nationalId` is stored and queried in cleartext; student auth is knowledge of name + full ID.
- Files: `prisma/schema.prisma`, `apps/server/src/routes/api/student/verify.ts`, `apps/server/src/routes/api/admin/roster-list.ts`
- Current mitigation: Format validation (`apps/server/src/lib/roster/national-id.ts`); generic error messages on failed verify (`apps/server/src/lib/errors.ts`).
- Recommendations: For stricter compliance, store HMAC/pepper hash of ID for lookup, never log full ID, and mask in all admin API responses (not only UI).

**Admin roster API returns full national IDs:**
- Risk: `GET /api/admin/roster` includes complete `nationalId` in JSON; UI masks in `AdminRoster.tsx` but any session holder or network capture sees full values.
- Files: `apps/server/src/routes/api/admin/roster-list.ts`, `apps/web/src/pages/AdminRoster.tsx`
- Current mitigation: `requireAdminSession`; LAN-only deployment assumption in `docs/DEPLOY.md`.
- Recommendations: Mask in API (`maskNationalId`) except dedicated export flows; audit logging without PII.

**HTTP-only transport by design:**
- Risk: Session cookie `sid` and credentials traverse the classroom LAN in cleartext unless TLS terminates at a proxy.
- Files: `docs/DEPLOY.md`, `apps/server/src/plugins/session.ts`
- Current mitigation: Documented path B (Nginx TLS); `httpOnly` + `sameSite: 'lax'` cookies.
- Recommendations: Treat path B as mandatory for any untrusted LAN segment; set `TRUST_PROXY=true` and `secure` cookies when behind HTTPS.

**Development session secret fallback:**
- Risk: Non-production uses hardcoded `dev-only-session-secret-change-me` if `SESSION_SECRET` is unset.
- Files: `apps/server/src/plugins/session.ts`
- Current mitigation: Throws in production when secret missing or short.
- Recommendations: Fail fast in staging too; document `SESSION_SECRET` in `.env.example` (already listed) and deployment checklist.

**Shared `sid` cookie for teacher + student (by design after 2026-05-17):**
- Risk: One PG session row may hold both `teacherId` and `studentRosterEntryId` when proctor tests student flow in the same browser.
- Files: `apps/server/src/lib/student-auth.ts`, `apps/server/src/plugins/session.ts`
- Current mitigation: Teacher login clears student fields; `await saveSession()` after login/verify; student APIs use `skipAuthRedirect` so student 401 does not toast-expire the teacher admin UI; `auth/me` uses `skipAuthRedirect`.
- Superseded: Dual-cookie `student_sid` chain (removed — caused unreliable PG writes and admin logout flakes). See `.planning/phases/03-roster-student-entry/03-CONTEXT.md` D-05 revision.
- Recommendations: For production proctoring, still prefer separate browser profiles when possible.

**Student verify brute-force surface:**
- Risk: `POST /api/student/verify` accepts name + 18-digit ID; rate limit defaults to 20/min (`STUDENT_VERIFY_RATE_LIMIT_MAX`).
- Files: `apps/server/src/routes/api/student/verify.ts`
- Current mitigation: Per-route rate limit; uniform 401 message.
- Recommendations: Lower limit during live exams; lockout per roster entry after N failures; captcha not required on LAN but monitor logs.

**No CSRF tokens on cookie-authenticated mutations:**
- Risk: Browsers send `sid` on same-site requests; cross-site POST risk is reduced by `SameSite=Lax` but not eliminated for all attack vectors.
- Files: `apps/server/src/plugins/session.ts`, `apps/web/src/lib/api.ts` (`credentials: 'include'`)
- Current mitigation: Same-site defaults; LAN-only scope.
- Recommendations: If admin UI is ever hosted on a different site than API, add CSRF double-submit or SameSite=Strict for admin routes.

**Default Postgres credentials in Compose:**
- Risk: `docker-compose.yml` uses `lan_exam_dev` password published in repo.
- Files: `docker-compose.yml`, `.env.example`
- Current mitigation: Documented as dev-only in `docs/DEPLOY.md`; DB port bound to `127.0.0.1`.
- Recommendations: Require override via env file in production Compose; never publish DB port on exam server NIC.

## Performance Bottlenecks

**Full workbook load on import:**
- Problem: Entire XLSX buffered and parsed synchronously on the event loop.
- Files: `apps/server/src/routes/api/admin/questions-import.ts`, `apps/server/src/lib/qbank/parse-workbook.ts`, `apps/server/src/lib/roster/parse-workbook.ts`
- Cause: `toBuffer()` + ExcelJS read in request handler.
- Improvement path: Size limits, worker thread for parse, or pre-validate row counts.

**Exam submit transaction loads all questions with options:**
- Problem: `submitExam` loads every `examQuestion` with nested `question.options` inside a 60s transaction.
- Files: `apps/server/src/lib/exam/submit.ts`
- Cause: Single large read + scoring loop for every student submit at exam end.
- Improvement path: Precompute option key lists at materialize time; index-friendly selects; shorten transaction to insert submission + answers only.

**Admin roster list is global and unscoped by batch:**
- Problem: `GET /api/admin/roster` queries all `RosterEntry` rows with optional text search, no `batchId` filter.
- Files: `apps/server/src/routes/api/admin/roster-list.ts`
- Cause: v1 UX lists entire imported roster history.
- Improvement path: Paginate (already capped `pageSize` max 100); add `batchId` filter before rosters scale to thousands.

## Fragile Areas

**Excel template and parsing pipeline:**
- Files: `apps/server/src/lib/qbank/parse-workbook.ts`, `apps/server/src/lib/qbank/validate-rows.ts`, `apps/server/src/lib/roster/parse-workbook.ts`, `apps/server/src/lib/roster/validate-rows.ts`, `docs/fixtures/import-test/`
- Why fragile: Column layout, example-row skipping, and answer normalization (`normalize-answer.ts`) must stay aligned with `.xlsx` templates; errors surface as 400 arrays or 500 `IMPORT_FAILED`.
- Safe modification: Run `apps/server/scripts/verify-import-test-files.mjs` and manual import of `docs/fixtures/import-test/` after template changes; extend `score-question.test.ts` when scoring rules change.
- Test coverage: Partial (scoring + national ID only); no automated import integration tests.

**Exam question materialization on draft edits:**
- Files: `apps/server/src/lib/exam/materialize-questions.ts`, `apps/server/src/routes/api/admin/exams-crud.ts`
- Why fragile: Changing `questionBatchId` on a DRAFT exam deletes and recreates all `ExamQuestion` rows; in-flight student drafts would reference stale `examQuestionId`s if an exam were mistakenly edited after students started (blocked for non-DRAFT status only).
- Safe modification: Only patch DRAFT exams; add integration test that started exams reject batch changes.
- Test coverage: None automated.

**Session + Express middleware inside Fastify:**
- Files: `apps/server/src/plugins/session.ts`, `apps/server/src/lib/session.ts`
- Why fragile: Mixing `@fastify/express` and `express-session` with custom `AppSession` fields; hook ordering affects `getRequestSession`.
- Safe modification: Touch session only through `saveSession` / `regenerate` helpers; verify login, student verify, and logout flows manually after plugin changes.
- Test coverage: None.

**Scoring rules for MULTI / JUDGE:**
- Files: `apps/server/src/lib/exam/score-question.ts`, `apps/server/src/lib/exam/score-question.test.ts`
- Why fragile: `ALL_OR_NOTHING` multi-select is the only `MultiScoringRule` in schema; new rules need schema + scorer + tests.
- Safe modification: Extend `score-question.test.ts` first (TDD); update import validator in `validate-rows.ts`.
- Test coverage: Good for MULTI/JUDGE unit cases; no end-to-end submit test.

## Scaling Limits

**Single API process + PostgreSQL session store:**
- Current capacity: One Node process (`apps/server/src/index.ts`); sessions in Postgres via `connect-pg-simple` (`apps/server/src/plugins/session.ts`).
- Limit: Horizontal scaling requires sticky sessions or shared session store already satisfied by PG; rate limits are in-memory per instance (`@fastify/rate-limit` with `global: false`).
- Scaling path: Redis-backed rate limit; multiple app replicas behind load balancer with `TRUST_PROXY`; connection pool tuning on `pg` Pool and Prisma.

**One IN_PROGRESS exam per roster batch:**
- Current capacity: Enforced in `startExam` (`ROSTER_BATCH_BUSY`).
- Limit: Cannot run two concurrent exams for the same imported roster batch; intentional for v1 LAN single-room flow.
- Scaling path: Product decision—relax constraint with explicit exam picker on student UI.

## Dependencies at Risk

**ExcelJS + large file uploads:**
- Risk: Memory-heavy parsing; less maintained than some alternatives for huge files.
- Impact: Import and export (`apps/server/src/lib/exam/export-workbook.ts`) fail or OOM under stress.
- Migration plan: Cap upload size first; evaluate streaming XLSX libraries only if sheets exceed practical exam sizes.

**express-session under Fastify 5:**
- Risk: Dual stack (`fastify` + `@fastify/express` + `express-session`) is uncommon; upgrades to either major version can break session typing or hook order.
- Impact: Total auth outage.
- Migration plan: Track `@fastify/secure-session` or native Fastify session plugins; add smoke test for login + student verify.

## Missing Critical Features

**Production static hosting for `@lan-exam/web`:**
- Problem: No first-class serving of Vite build output from the production container or Compose stack.
- Blocks: Single-container “exam appliance” deployments without custom Nginx config.

**Automated CI and dependency audit gate:**
- Problem: README mentions `pnpm audit` but no workflow enforces it.
- Blocks: Consistent pre-merge verification.

**Multi-teacher administration:**
- Problem: Only seed account; no invite/reset flows beyond change-password for logged-in teacher.
- Blocks: Shared admin duty across staff without DB access.

## Test Coverage Gaps

**HTTP API and auth flows:**
- What's not tested: Login, logout, session expiry, `mustChangePassword` guard, student verify, admin guards.
- Files: `apps/server/src/routes/api/auth/`, `apps/server/src/plugins/admin-guard.ts`, `apps/server/src/plugins/student-guard.ts`
- Risk: Session regressions ship unnoticed.
- Priority: High

**Exam lifecycle and submit path:**
- What's not tested: `startExam` / `endExam`, `submitExam`, draft upsert, `ALREADY_SUBMITTED`, concurrent submit.
- Files: `apps/server/src/lib/exam/transition.ts`, `apps/server/src/lib/exam/submit.ts`, `apps/server/src/routes/api/student/exam-*.ts`
- Risk: Wrong scores, double submission, or 500s during exam day.
- Priority: High

**Import pipelines (roster + qbank):**
- What's not tested: Automated tests against `docs/fixtures/import-test/` through HTTP multipart (only manual scripts).
- Files: `apps/server/scripts/verify-import-test-files.mjs`, import routes under `apps/server/src/routes/api/admin/`
- Risk: Template drift breaks exam day imports.
- Priority: Medium

**Frontend (React):**
- What's not tested: No component or E2E tests for `apps/web/src/pages/*` or exam student flow.
- Files: `apps/web/src/`
- Risk: UI regressions in timed exam UX.
- Priority: Medium

---

*Concerns audit: 2026-05-17*

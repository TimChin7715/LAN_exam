# Testing Patterns

**Analysis Date:** 2026-05-17

## Test Framework

**Runner:**
- **Node.js built-in test runner** (`node:test`) — no Jest, Vitest, or Playwright in package manifests.
- Tests run TypeScript source via **`tsx` loader**: `node --import tsx --test <path-to-test.ts>`.
- Assertion library: **`node:assert/strict`** (`assert.equal`, etc.).

**Config:**
- No `vitest.config.*`, `jest.config.*`, or root `"test"` script in `package.json` / `apps/server/package.json` / `apps/web/package.json`.
- TypeScript: tests live under `apps/server/src/` and compile with the same `apps/server/tsconfig.json` as production code (not excluded).

**Run commands:**
```bash
# Single module (from repo root)
node --import tsx --test apps/server/src/lib/exam/score-question.test.ts
node --import tsx --test apps/server/src/lib/roster/national-id.test.ts

# All server unit tests discovered by path convention
node --import tsx --test apps/server/src/lib/**/*.test.ts

# Typecheck + build (primary CI substitute today)
pnpm -r build
```

**Watch mode:** Not configured. Re-run `node --import tsx --test` manually after changes.

## Test File Organization

**Location:**
- **Co-located** with implementation under `apps/server/src/lib/`:
  - `apps/server/src/lib/exam/score-question.test.ts` ↔ `score-question.ts`
  - `apps/server/src/lib/roster/national-id.test.ts` ↔ `national-id.ts`

**Naming:**
- `{module-name}.test.ts` beside `{module-name}.ts`.

**Structure:**
```
apps/server/src/lib/
├── exam/
│   ├── score-question.ts
│   └── score-question.test.ts
└── roster/
    ├── national-id.ts
    └── national-id.test.ts

apps/web/src/          # No *.test.ts files detected
```

**Web (`apps/web`):**
- No unit, component, or E2E test files. UI verification relies on `pnpm build`, manual/UAT flows documented under `.planning/phases/*/`.

## Test Structure

**Suite organization:**
```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scoreQuestion, type ScoreableQuestion } from './score-question.js';

const multiBase: ScoreableQuestion = {
  type: 'MULTI',
  answerKeys: 'A,B,C',
  points: 5,
  multiScoringRule: 'ALL_OR_NOTHING',
  optionKeys: ['A', 'B', 'C', 'D'],
};

describe('scoreQuestion MULTI ALL_OR_NOTHING', () => {
  it('awards full points when selected set matches answerKeys exactly', () => {
    const result = scoreQuestion(multiBase, 'A,B,C');
    assert.equal(result.isCorrect, true);
    assert.equal(result.pointsAwarded, 5);
  });
});
```

**Patterns:**
- **Setup:** inline `const` fixtures at top of file or inside `describe`; no `beforeEach` in current tests.
- **Teardown:** not used (pure functions only).
- **Assertions:** strict equality via `assert.equal`; no snapshot or mock libraries.
- **Grouping:** one `describe` per behavior area (question type, edge case); multiple `it` cases per describe.
- **Imports:** same **`.js` extension** on relative imports as production server code.

## Mocking

**Framework:** None (no `sinon`, `vitest` mocks, or `node:test` mock timers in use).

**Patterns:**
- Test **pure functions** and deterministic logic only.
- Do not mock Prisma, Fastify, or filesystem in existing tests.

**What to mock:**
- Avoid mocking in new unit tests unless introducing impure modules; prefer extracting pure logic to `lib/` (pattern used for `scoreQuestion` and `isValidNationalIdFormat`).

**What NOT to mock:**
- Database (`PrismaClient`), Excel parsing (`exceljs`), session store, or HTTP layer in unit tests — cover those via integration/manual UAT or future dedicated integration tests.

## Fixtures and Factories

**Test data:**
- Define minimal typed objects inline (`ScoreableQuestion` in `score-question.test.ts`).
- Use realistic Chinese judge labels where domain requires (`正确`, `错误` in judge tests).

**Shared fixtures:**
- Not centralized. For repeated domain blobs, add `apps/server/src/lib/{area}/__fixtures__/` or export factory helpers from `*.test.ts` only if multiple files need them.

**Repo fixtures (manual / UAT, not automated tests):**
- `docs/templates/` — official xlsx templates.
- `docs/fixtures/import-test/` — sample workbooks for human import verification (referenced in `.planning/phases/02-qbank-import/02-VERIFICATION.md`).

## Coverage

**Requirements:** None enforced in tooling or CI.

**View coverage:** Not configured (no `c8`/`istanbul`/`vitest --coverage`).

**Practical gate:** Phase verification docs cite passing `node --import tsx --test` for specific files (e.g. `.planning/phases/04-exam-submit-export/04-VERIFICATION.md` — 8/8 for `score-question.test.ts`).

## Test Types

**Unit tests:**
- **Scope:** Pure logic in `apps/server/src/lib/` (scoring, national ID checksum).
- **Approach:** Table-driven cases via multiple `it` blocks; edge cases (empty selection, wrong checksum, extra multi-select option).

**Integration tests:**
- Not present. Routes such as `apps/server/src/routes/api/admin/questions-import.ts` are validated manually with Postgres + browser.

**E2E tests:**
- Not used. Human verification checklists live in `.planning/phases/*/*-UAT.md` and `*-VERIFICATION.md`.

## Common Patterns

**Async testing:**
- Current tests are synchronous. For future `async` units:
```typescript
it('resolves expected value', async () => {
  const result = await someAsyncFn();
  assert.equal(result, expected);
});
```

**Error testing:**
- Prefer asserting return shape over `assert.throws` for domain functions that return error results.
- For throwable domain errors (`ExamAccessError`), unit-test the function that throws before the route maps it:
```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('myFn', () => {
  it('throws SubmitExamError when already submitted', () => {
    assert.throws(
      () => { /* call fn */ },
      (err: unknown) => err instanceof SubmitExamError && err.code === 'ALREADY_SUBMITTED',
    );
  });
});
```

## Where to Add Tests

| Change type | Add test here |
|-------------|----------------|
| Scoring / exam rules | `apps/server/src/lib/exam/*.test.ts` next to module |
| Roster / ID validation | `apps/server/src/lib/roster/*.test.ts` |
| Qbank row validation / normalize | `apps/server/src/lib/qbank/*.test.ts` (new) |
| HTTP route behavior | Prefer extracting logic to `lib/` + unit test; integration tests not yet standard |
| React page / hook | No pattern yet — manual UAT or introduce Vitest in `apps/web` as a deliberate toolchain change |

## Recommended npm Script (not yet in repo)

When wiring CI, add to root or `@lan-exam/server` `package.json`:

```json
"test": "node --import tsx --test apps/server/src/lib/**/*.test.ts"
```

Until then, document the exact `node --import tsx --test <file>` command in plan/verification artifacts (existing GSD phase pattern).

## Pre-merge Verification Checklist

1. `node --import tsx --test` on every touched `*.test.ts` under `apps/server/src/lib/`.
2. `pnpm -r build` (server `tsc` + web `tsc -b && vite build`).
3. For features touching imports/DB: manual flow with Docker or local Postgres per `README.md` / `docs/DEPLOY.md`.

---

*Testing analysis: 2026-05-17*

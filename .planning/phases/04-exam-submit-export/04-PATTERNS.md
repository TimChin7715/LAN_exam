# Phase 4: 考试、提交与导出 - Pattern Map

**Mapped:** 2026-05-16  
**Files analyzed:** 34 new/modified  
**Analogs found:** 30 / 34

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` | model | CRUD | `QuestionImportBatch` + `RosterImportBatch` | exact |
| `prisma/migrations/*` | migration | batch | Phase 2/3 migrations | role-match |
| `apps/server/src/lib/exam/access.ts` | utility | request-response | `student/me.ts` + roster `batchId` check | role-match |
| `apps/server/src/lib/exam/score-question.ts` | utility | transform | `lib/qbank/normalize-answer.ts` | exact |
| `apps/server/src/lib/exam/score-question.test.ts` | test | transform | `lib/roster/national-id.test.ts` | exact |
| `apps/server/src/lib/exam/transition.ts` | service | CRUD | `lib/roster/import-roster.ts` (`$transaction`) | role-match |
| `apps/server/src/lib/exam/submit.ts` | service | batch | `lib/qbank/import-questions.ts` | exact |
| `apps/server/src/lib/exam/export-workbook.ts` | service | file-I/O | `scripts/generate-roster-template.ts` + `roster-template.ts` | role-match |
| `apps/server/src/routes/api/admin/exams-crud.ts` | route | CRUD | `admin/questions-list.ts` | exact |
| `apps/server/src/routes/api/admin/exams-lifecycle.ts` | route | request-response | `student/verify.ts` (POST + domain errors) | role-match |
| `apps/server/src/routes/api/admin/exams-export.ts` | route | file-I/O | `admin/roster-template.ts` | exact |
| `apps/server/src/routes/api/student/exam-status.ts` | route | request-response | `student/me.ts` | exact |
| `apps/server/src/routes/api/student/exam-paper.ts` | route | request-response | `admin/questions-list.ts` (`:id` + include) | role-match |
| `apps/server/src/routes/api/student/exam-answers.ts` | route | CRUD | `student/verify.ts` (zod body + guard) | role-match |
| `apps/server/src/routes/api/student/exam-submit.ts` | route | batch | `admin/roster-import.ts` (rateLimit) | role-match |
| `apps/server/src/routes/api/student/index.ts` | config | — | same file (register routes) | exact |
| `apps/server/src/index.ts` | config | — | same file | exact |
| `apps/web/src/lib/exam.ts` | utility | request-response | `lib/roster.ts` + `lib/qbank.ts` | exact |
| `apps/web/src/lib/student.ts` | utility | request-response | same file (extend `studentApi`) | exact |
| `apps/web/src/pages/AdminExams.tsx` | component | CRUD | `pages/AdminRoster.tsx` | exact |
| `apps/web/src/pages/AdminExamDetail.tsx` *(or nested in list)* | component | CRUD + request-response | `AdminQuestions.tsx` + `QuestionDetailDialog` | role-match |
| `apps/web/src/pages/StudentWaiting.tsx` | component | request-response | same file + RESEARCH polling snippet | exact |
| `apps/web/src/pages/StudentExamTake.tsx` | component | request-response | `StudentLogin.tsx` + `QuestionPreviewCards` | partial |
| `apps/web/src/pages/AdminDashboard.tsx` | component | — | 题库/名单 `Link` card | exact |
| `apps/web/src/router.tsx` | route | — | same file | exact |
| `apps/web/src/components/auth/StudentRoute.tsx` | middleware (UI) | request-response | same file (extend `/exam/take`) | exact |
| `apps/web/src/components/ui/alert-dialog.tsx` *(if added)* | component | — | `components/ui/dialog.tsx` | role-match |
| `apps/web/src/components/ui/radio-group.tsx` *(if added)* | component | — | shadcn new-york (no in-repo analog) | none |
| `apps/web/src/components/ui/checkbox.tsx` *(if added)* | component | — | shadcn new-york (no in-repo analog) | none |
| `apps/web/src/components/ui/tooltip.tsx` *(if added)* | component | — | shadcn new-york (no in-repo analog) | none |
| `apps/server/src/routes/api/admin/exam-batches.ts` *(optional)* | route | CRUD | `questions-list.ts` (`batchId` filter) | partial |

## Pattern Assignments

### `prisma/schema.prisma` (model, CRUD)

**Analog:** `QuestionImportBatch` + `RosterImportBatch` + `Question` relations

**Teacher + batch parent** (lines 11-21, 33-45):

```prisma
model Teacher {
  id                     String                @id @default(cuid())
  // ...
  questionImportBatches  QuestionImportBatch[]
  rosterImportBatches    RosterImportBatch[]
}

model QuestionImportBatch {
  id            String     @id @default(cuid())
  teacherId     String
  teacher       Teacher    @relation(fields: [teacherId], references: [id])
  fileName      String
  // ...
  questions     Question[]
  @@index([teacherId])
}
```

**Child with cascade + indexes** (lines 47-64, 91-102):

```prisma
model Question {
  id               String              @id @default(cuid())
  batchId          String
  batch            QuestionImportBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  // ...
  @@index([batchId])
}

model RosterEntry {
  id          String            @id @default(cuid())
  batchId     String
  batch       RosterImportBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  @@unique([fullName, nationalId])
  @@index([batchId])
}
```

Mirror for `Exam` (FK to `questionBatchId` / `rosterBatchId`), `ExamQuestion`, `Submission @@unique([examId, rosterEntryId])`, `AnswerDraft @@unique([examId, rosterEntryId, examQuestionId])`, `enum ExamStatus`.

---

### `apps/server/src/lib/exam/access.ts` (utility, request-response)

**Analog:** `apps/server/src/routes/api/student/me.ts` + roster `batchId` semantics from `verify.ts`

**Session roster id** (lines 14-17, `student-auth.ts`):

```typescript
export function getSessionRosterEntryId(
  request: FastifyRequest,
): string | undefined {
  return getStudentSession(request)?.studentRosterEntryId;
}
```

**Load entry + 401** (`me.ts` lines 14-24):

```typescript
const rosterEntryId = getSessionRosterEntryId(request);
if (!rosterEntryId) {
  return reply.status(401).send({ error: 'Unauthorized' });
}
const entry = await prisma.rosterEntry.findUnique({
  where: { id: rosterEntryId },
});
```

**403 笼统文案** — follow `verify.ts` failed-auth style (no roster leak): use Chinese `message` field like student routes, not admin `{ error, code }` only.

Implement `assertStudentExamAccess` per RESEARCH: compare `entry.batchId === exam.rosterBatchId`; `write`/`submit` require `exam.status === 'IN_PROGRESS'`; existing `Submission` → 409 on submit.

---

### `apps/server/src/lib/exam/score-question.ts` (utility, transform)

**Analog:** `apps/server/src/lib/qbank/normalize-answer.ts`

**Imports + MULTI token compare** (lines 1-45):

```typescript
import type { QuestionType } from '@prisma/client';

export function splitAnswerTokens(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,，、\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((k) => /^[A-Z]$/.test(k)),
    ),
  ].sort();
}

export function normalizeAnswerKeys(
  type: QuestionType,
  raw: string,
  optionKeys: string[],
): string | null {
  // SINGLE / MULTI / JUDGE branches...
  const tokens = splitAnswerTokens(trimmed);
  // ...
  return tokens.join(',');
}
```

**MUST:** `scoreQuestion` calls `normalizeAnswerKeys` then for `MULTI` compares `splitAnswerTokens(selected).join(',')` to `splitAnswerTokens(answerKeys).join(',')` with `multiScoringRule === 'ALL_OR_NOTHING'` (see `04-RESEARCH.md` excerpt).

---

### `apps/server/src/lib/exam/score-question.test.ts` (test, transform)

**Analog:** `apps/server/src/lib/roster/national-id.test.ts`

**Node test harness** (lines 1-17):

```typescript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidNationalIdFormat } from './national-id.js';

describe('isValidNationalIdFormat', () => {
  it('accepts a valid 18-digit ID with correct checksum', () => {
    assert.equal(isValidNationalIdFormat('11010519491231002X'), true);
  });
});
```

Cover MULTI/SINGLE/JUDGE cases aligned with `02-ACCEPTANCE.md` QBANK-02.

---

### `apps/server/src/lib/exam/transition.ts` (service, CRUD)

**Analog:** `apps/server/src/lib/roster/import-roster.ts`

**Transaction wrapper** (lines 24-42):

```typescript
const batch = await prisma.$transaction(
  async (tx) => {
    return tx.rosterImportBatch.create({
      data: {
        teacherId,
        fileName,
        // nested create...
      },
    });
  },
  { timeout: 30_000 },
);
```

**`startExam` / `endExam`:** single `tx.exam.update` after guards (`status === DRAFT` / `IN_PROGRESS`); `start` checks `examQuestion.count > 0` and no other `IN_PROGRESS` on same `rosterBatchId`; return typed errors → route maps to **409** + Chinese `message`.

---

### `apps/server/src/lib/exam/submit.ts` (service, batch)

**Analog:** `apps/server/src/lib/qbank/import-questions.ts`

**Nested create in transaction** (lines 24-54):

```typescript
const batch = await prisma.$transaction(
  async (tx) => {
    return tx.questionImportBatch.create({
      data: {
        teacherId,
        fileName,
        questions: {
          create: questions.map((q) => ({
            // ...
            options: { create: q.options.map(...) },
          })),
        },
      },
    });
  },
  { timeout: 30_000 },
);
```

**Submit flow:** `assertStudentExamAccess(..., 'submit')` → if `Submission` exists throw → load drafts + `ExamQuestion`+`Question`+`options` → `scoreQuestion` each → `submission.create` + `answer.createMany` → `answerDraft.deleteMany` — all inside one `$transaction`.

---

### `apps/server/src/lib/exam/export-workbook.ts` (service, file-I/O)

**Analog:** `apps/server/scripts/generate-roster-template.ts` (write) + `apps/server/src/routes/api/admin/roster-template.ts` (HTTP headers)

**Workbook + sheet columns** (`generate-roster-template.ts` lines 11-19):

```typescript
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('名单导入');

sheet.columns = [
  { header: '姓名', key: 'name', width: 16 },
  { header: '身份证号', key: 'id', width: 22 },
];

sheet.getRow(1).font = { bold: true };
```

Add sheets「成绩汇总」「答题明细」; use `maskNationalId` from `apps/web/src/lib/roster.ts` (lines 31-35) or duplicate server-side:

```typescript
export function maskNationalId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length !== 18) return '—';
  return `${trimmed.slice(0, 6)}********${trimmed.slice(-4)}`;
}
```

**Stream to client:** prefer `await workbook.xlsx.write(reply.raw)` (Fastify) with headers from `roster-template.ts` (lines 26-32):

```typescript
return reply
  .header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  .header('Content-Disposition', TEMPLATE_DISPOSITION)
  .send(createReadStream(templatePath));
```

Use `filename*=UTF-8''` encoding for Chinese exam title in `Content-Disposition`.

---

### `apps/server/src/routes/api/admin/exams-crud.ts` (route, CRUD)

**Analog:** `apps/server/src/routes/api/admin/questions-list.ts`

**Route registration + zod query** (lines 14-27):

```typescript
export async function registerAdminQuestionsListRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/api/admin/questions',
    { preHandler: requireAdminSession },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
        });
      }
```

**List response shape** (lines 55-61):

```typescript
return reply.send({
  ok: true,
  page,
  pageSize,
  total,
  items,
});
```

**Detail** — copy `GET /api/admin/questions/:id` (lines 65-93): `findUnique` + `include`, 404 `{ error, code }`.

**POST create:** zod `{ title, questionBatchId, rosterBatchId }`; `getSessionTeacherId` from `lib/auth.ts` (see `roster-import.ts` lines 27-30); materialize `ExamQuestion` in service layer; **PATCH** only when `status === DRAFT`.

---

### `apps/server/src/routes/api/admin/exams-lifecycle.ts` (route, request-response)

**Analog:** `apps/server/src/routes/api/student/verify.ts` (POST + structured errors)

**Rate limit on sensitive POST** (`verify.ts` lines 22-30):

```typescript
app.post(
  '/api/student/verify',
  {
    config: {
      rateLimit: {
        max: Number(process.env.STUDENT_VERIFY_RATE_LIMIT_MAX ?? 20),
        timeWindow: '1 minute',
      },
    },
  },
```

Map `POST /api/admin/exams/:id/start|end` → `startExam`/`endExam`; 409 body `{ code: 'CONFLICT', message: '...' }` with Chinese copy from UI-SPEC.

---

### `apps/server/src/routes/api/admin/exams-export.ts` (route, file-I/O)

**Analog:** `apps/server/src/routes/api/admin/roster-template.ts`

Full handler pattern (lines 16-33): `requireAdminSession` → `exportExamWorkbook(examId)` → set xlsx `Content-Type` + `Content-Disposition: attachment` → stream body (no JSON).

---

### `apps/server/src/routes/api/student/exam-status.ts` (route, request-response)

**Analog:** `apps/server/src/routes/api/student/me.ts`

**Guard + session field** (lines 10-30):

```typescript
app.get(
  '/api/student/me',
  { preHandler: requireStudentSession },
  async (request, reply) => {
    const rosterEntryId = getSessionRosterEntryId(request);
    // ...
    return reply.send({
      fullName: entry.fullName,
      nationalId: entry.nationalId,
    });
  },
);
```

Resolve active exam: `IN_PROGRESS` where `exam.rosterBatchId === entry.batchId`; return `{ status: 'IN_PROGRESS', examId, title }` or `{ status: 'none' }` — **never** leak other batches.

---

### `apps/server/src/routes/api/student/exam-paper.ts` (route, request-response)

**Analog:** `questions-list.ts` `GET :id` with selective `select`/`include`

**Include options ordered** (lines 71-75):

```typescript
include: {
  options: { orderBy: { sortOrder: 'asc' } },
  batch: { select: { id: true, fileName: true, createdAt: true } },
},
```

**Strip `answerKeys`** from JSON sent to student; include `examQuestionId`, `type`, `stem`, `points`, `options`.

---

### `apps/server/src/routes/api/student/exam-answers.ts` (route, CRUD)

**Analog:** `student/verify.ts` body validation

**Zod body** (lines 14-17, 33-38):

```typescript
const verifyBodySchema = z.object({
  fullName: z.string().trim().min(1).max(64),
  nationalId: z.string().trim().min(1).max(18),
});

const parsed = verifyBodySchema.safeParse(request.body);
if (!parsed.success) {
  return reply.status(400).send({
    code: 'VALIDATION_ERROR',
    message: '请求参数无效',
  });
}
```

`PUT` body: `{ examId, answers: [{ examQuestionId, selectedKeys }] }`; `assertStudentExamAccess(..., 'write')`; reject if `Submission` exists (409); upsert `AnswerDraft`.

Optional route `config.rateLimit` like import routes.

---

### `apps/server/src/routes/api/student/exam-submit.ts` (route, batch)

**Analog:** `admin/roster-import.ts` + `lib/exam/submit.ts`

Call `submitExam(prisma, request)` from handler; map domain errors to 409/403; success `{ ok: true, totalScore, submittedAt }` without exposing other students' data.

---

### `apps/server/src/index.ts` + `routes/api/student/index.ts` (config)

**Analog:** existing registration (lines 30-38, `student/index.ts` lines 7-12)

```typescript
await registerStudentVerifyRoutes(app);
await registerStudentMeRoutes(app);
await registerStudentLogoutRoutes(app);
```

Add `registerAdminExamsCrudRoutes`, `registerAdminExamsLifecycleRoutes`, `registerAdminExamsExportRoutes`, and student exam route registrars in same order (after session plugin).

---

### `apps/web/src/lib/exam.ts` (utility, request-response)

**Analog:** `apps/web/src/lib/roster.ts` + `apps/web/src/lib/qbank.ts`

**apiFetch list** (`roster.ts` lines 108-138):

```typescript
export async function fetchRosterList(params: {
  page: number;
  pageSize?: number;
  query?: string;
}): Promise<{ items: RosterListItem[]; total: number; page: number; pageSize: number }> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? 20),
  });
  const data = await apiFetch<{ ok: boolean; items: RosterListItem[]; total: number; page: number; pageSize: number }>(
    `/api/admin/roster?${search.toString()}`,
  );
  return { items: data.items, total: data.total, page: data.page, pageSize: data.pageSize };
}
```

**Blob export** (`roster.ts` lines 37-58):

```typescript
const response = await fetch('/api/admin/roster/template', {
  credentials: 'include',
});
// 401 → toast + ApiError
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const anchor = document.createElement('a');
anchor.href = url;
anchor.download = '名单导入模板.xlsx';
anchor.click();
URL.revokeObjectURL(url);
```

Export: `GET /api/admin/exams/:id/export` with `download` filename `{title}-成绩与明细.xlsx`. Re-export `maskNationalId` from `roster.ts` for client display tables.

---

### `apps/web/src/lib/student.ts` (utility, request-response)

**Analog:** same file

**apiFetch wrapper** (lines 13-28):

```typescript
export const studentApi = {
  verify: (fullName: string, nationalId: string) =>
    apiFetch<{ ok: true }>('/api/student/verify', {
      method: 'POST',
      body: JSON.stringify({ fullName, nationalId }),
      skipAuthRedirect: true,
    }),

  me: () =>
    apiFetch<StudentProfile>('/api/student/me', { skipAuthRedirect: true }),
};
```

Extend with `examStatus`, `paper`, `saveAnswers`, `submit`, `submission` — all `skipAuthRedirect: true`; handle 409 via `ApiError` + `code`.

---

### `apps/web/src/pages/AdminExams.tsx` (component, CRUD)

**Analog:** `apps/web/src/pages/AdminRoster.tsx`

**Page shell** (`AdminRoster.tsx` lines 107-121):

```tsx
<div className="space-y-8">
  <div className="space-y-2">
    <Link
      to="/admin"
      className="inline-block text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      ← 返回仪表盘
    </Link>
    <h1 className="text-xl font-semibold leading-tight text-foreground">
      名单管理
    </h1>
    <p className="text-base text-muted-foreground">...</p>
  </div>
```

Replace title/copy per UI-SPEC S1; table columns + status `Badge` (`AdminQuestions.tsx` lines 10-11, 52-62 for Badge usage); empty state + Primary CTA.

**新建考试 Dialog** — `QuestionDetailDialog.tsx` / shadcn `Dialog` (lines 43-68): controlled `open`/`onOpenChange`, `Select` for batches from `AdminQuestions.tsx` (lines 14-20, 56-57).

---

### `apps/web/src/pages/AdminExamDetail.tsx` (component, CRUD + request-response)

**Analog:** `AdminQuestions.tsx` + `QuestionDetailDialog.tsx`

**Lifecycle actions:** Primary/destructive `Button` + confirmation — use new `AlertDialog` per UI-SPEC (install shadcn; structure mirrors `Dialog` in `dialog.tsx` lines 10-80).

**成绩表:** reuse `Table` + `maskNationalId` + `formatImportedAt` from `AdminRoster.tsx` (lines 30-34, 22-28).

**题目预览:** read-only list like `QuestionPreviewCards.tsx` (Card + Badge + stem + options) but **show answerKeys** for teachers.

---

### `apps/web/src/pages/StudentWaiting.tsx` (component, request-response)

**Analog:** same file (extend, do not replace Phase 3 UX)

**Existing profile load** (lines 21-42):

```typescript
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const me = await studentApi.me();
      if (!cancelled) setProfile(me);
    } catch (err) {
      if (!cancelled) {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/exam/login', { replace: true });
          return;
        }
        navigate('/exam/login', { replace: true });
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();
  return () => { cancelled = true; };
}, [navigate]);
```

**Add polling** (per `04-RESEARCH.md`): second `useEffect` when `profile` set — `setInterval(4000)`, pause when `document.hidden`, `studentApi.examStatus()` → `navigate('/exam/take?examId=...', { replace: true })`; optional muted Spinner copy per UI-SPEC S6.

---

### `apps/web/src/pages/StudentExamTake.tsx` (component, request-response)

**Analog:** `StudentLogin.tsx` (form state/errors) + `QuestionPreviewCards.tsx` (per-question Card)

**Submit + ApiError** (`StudentLogin.tsx` lines 56-78):

```typescript
try {
  await studentApi.verify(fullName, nationalId);
  navigate('/exam/waiting', { replace: true });
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    setFormError(STUDENT_AUTH_ERROR_MESSAGE);
    return;
  }
  setFormError('无法连接服务器，请检查网络或联系机房管理员。');
}
```

**Debounce save:** no in-repo analog — implement `useRef` + `setTimeout(2000)` on answer change; toast「已保存」via `sonner` like `AdminRoster.tsx` line 81.

**Question UI:** Card per item from `QuestionPreviewCards.tsx` (lines 49-80); replace static list with `RadioGroup`/`Checkbox` (new shadcn components per UI-SPEC).

**Submit:** `AlertDialog` confirmation; sticky footer pattern — new layout, but Button loading uses `Loader2` from `StudentWaiting.tsx` (lines 98-100).

---

### `apps/web/src/pages/AdminDashboard.tsx` (component)

**Analog:** 题库/名单 enabled cards (lines 8-12, 32-66)

```typescript
const PLACEHOLDER_CARDS = [
  { title: '题库', icon: BookOpen, href: '/admin/questions' as const },
  { title: '名单', icon: Users, href: '/admin/roster' as const },
  { title: '考试', icon: ClipboardList },
] as const;
```

Add `href: '/admin/exams'` to 考试 card; remove `cursor-not-allowed opacity-60` for that card; update intro copy per UI-SPEC S0.

---

### `apps/web/src/router.tsx` (route)

**Analog:** same file (lines 25-41)

```tsx
<Route path="/exam" element={<StudentRoute />}>
  <Route path="login" element={<StudentLogin />} />
  <Route path="waiting" element={<StudentWaiting />} />
</Route>

<Route element={<AdminLayout />}>
  <Route path="questions" element={<AdminQuestions />} />
  <Route path="roster" element={<AdminRoster />} />
</Route>
```

Add `<Route path="take" element={<StudentExamTake />} />` under `/exam`; `<Route path="exams" element={<AdminExams />} />` and `<Route path="exams/:examId" element={<AdminExamDetail />} />` under admin layout.

---

### `apps/web/src/components/auth/StudentRoute.tsx` (middleware UI)

**Analog:** same file

**Auth check** (lines 14-36, 47-53):

```typescript
if (status === 'unauthenticated' && location.pathname === '/exam/waiting') {
  return <Navigate to="/exam/login" replace />;
}

if (status === 'authenticated' && location.pathname === '/exam/login') {
  return <Navigate to="/exam/waiting" replace />;
}
```

Extend: `/exam/take` requires authenticated; optional redirect waiting → take when API reports `IN_PROGRESS` (mirror polling).

---

## Shared Patterns

### Admin authentication
**Source:** `apps/server/src/plugins/admin-guard.ts`  
**Apply to:** All `routes/api/admin/exams-*.ts`

```typescript
export async function requireAdminSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const teacherId = getSessionTeacherId(request);
  if (!teacherId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const user = await loadSessionUser(request);
  if (!user) {
    getRequestSession(request)?.destroy(() => {});
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  if (user.mustChangePassword) {
    return reply.status(401).send({
      error: 'Password change required',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
}
```

### Student authentication
**Source:** `apps/server/src/plugins/student-guard.ts`  
**Apply to:** All `routes/api/student/exam-*.ts`

```typescript
export async function requireStudentSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const rosterEntryId = getSessionRosterEntryId(request);
  if (!rosterEntryId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}
```

**Never** read `rosterEntryId` from request body — only session (`03-ACCEPTANCE`).

### HTTP client (web)
**Source:** `apps/web/src/lib/api.ts`  
**Apply to:** `lib/exam.ts`, extended `lib/student.ts`

```typescript
const response = await fetch(path, {
  ...init,
  credentials: 'include',
  headers,
});
```

Use `skipAuthRedirect: true` on student exam calls; blob export uses raw `fetch` like `downloadRosterTemplate`.

### Prisma transactions
**Source:** `import-questions.ts` / `import-roster.ts`  
**Apply to:** `transition.ts`, `submit.ts`, exam create (materialize questions)

```typescript
await prisma.$transaction(async (tx) => { /* ... */ }, { timeout: 30_000 });
```

### Scoring (QBANK-02)
**Source:** `apps/server/src/lib/qbank/normalize-answer.ts`  
**Apply to:** `score-question.ts`, `submit.ts` only — **no** client-side scoring

### ID masking (export + admin tables)
**Source:** `apps/web/src/lib/roster.ts` lines 31-35  
**Apply to:** Admin submission table + `export-workbook.ts`

### Toast feedback
**Source:** `AdminRoster.tsx` / `api.ts`  
**Apply to:** All admin exam mutations and import-style errors

```typescript
toast.success(`已成功导入 ${result.importedCount} 名考生。`);
toast.error('登录已过期，请重新登录。');
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/components/ui/radio-group.tsx` | component | — | Not in repo; add via shadcn per UI-SPEC |
| `apps/web/src/components/ui/checkbox.tsx` | component | — | Not in repo; student multi-select UX |
| `apps/web/src/components/ui/alert-dialog.tsx` | component | — | Not in repo; confirm start/end/submit |
| `apps/web/src/components/ui/tooltip.tsx` | component | — | Optional export disabled hint |
| `apps/web` debounce autosave hook | hook | request-response | No `setInterval`/`debounce` in web yet; follow RESEARCH 2s debounce |
| `apps/server` dynamic xlsx stream to `reply.raw` | service | file-I/O | Templates use `createReadStream`; generated workbook pattern from `generate-roster-template.ts` + Fastify docs |

Planner: use `04-RESEARCH.md` and `04-UI-SPEC.md` for these gaps; shadcn CLI aligns with existing `components.json`.

---

## Metadata

**Analog search scope:** `apps/server/src/`, `apps/web/src/`, `prisma/`, `apps/server/scripts/`  
**Files scanned:** ~85 TypeScript/TSX sources  
**Pattern extraction date:** 2026-05-16

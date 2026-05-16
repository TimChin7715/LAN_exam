# Phase 3: 名单与学生入场 - Pattern Map

**Mapped:** 2026-05-16  
**Files analyzed:** 32 new/modified  
**Analogs found:** 28 / 32

> **⚠ 会话模型（2026-05-17，权威）：** 实现为 **单一 `sid` Cookie** + PG 行内 `teacherId` / `studentRosterEntryId` 字段隔离；`await saveSession()` 在 login/verify 后落库；**勿**再实现下文中的链式 `student_sid` 双中间件。详见 `03-CONTEXT.md` D-05 修订、`01-CONTEXT.md` D-09/D-10。

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` | model | CRUD | `QuestionImportBatch` / `Question` in same file | exact |
| `docs/templates/名单导入模板.xlsx` | config | file-I/O | `docs/templates/题库导入模板.xlsx` | exact |
| `apps/server/src/lib/roster/types.ts` | utility | transform | `apps/server/src/lib/qbank/types.ts` | exact |
| `apps/server/src/lib/roster/national-id.ts` | utility | transform | *(no analog — pure validation)* | none |
| `apps/server/src/lib/roster/parse-workbook.ts` | utility | file-I/O | `apps/server/src/lib/qbank/parse-workbook.ts` | exact |
| `apps/server/src/lib/roster/validate-rows.ts` | utility | transform | `apps/server/src/lib/qbank/validate-rows.ts` | exact |
| `apps/server/src/lib/roster/import-roster.ts` | service | batch | `apps/server/src/lib/qbank/import-questions.ts` | exact |
| `apps/server/src/lib/student-auth.ts` | utility | request-response | `apps/server/src/lib/auth.ts` | role-match |
| `apps/server/src/plugins/session.ts` | middleware | request-response | same file (extend) | exact |
| `apps/server/src/types/session.d.ts` | config | — | same file (extend) | exact |
| `apps/server/src/plugins/student-guard.ts` | middleware | request-response | `apps/server/src/plugins/admin-guard.ts` | exact |
| `apps/server/src/routes/api/admin/roster-import.ts` | route | file-I/O | `questions-import.ts` | exact |
| `apps/server/src/routes/api/admin/roster-template.ts` | route | file-I/O | `questions-template.ts` | exact |
| `apps/server/src/routes/api/admin/roster-list.ts` | route | CRUD | `questions-list.ts` | role-match |
| `apps/server/src/routes/api/student/verify.ts` | route | request-response | `auth/login.ts` | role-match |
| `apps/server/src/routes/api/student/me.ts` | route | request-response | `auth/me.ts` | exact |
| `apps/server/src/routes/api/student/logout.ts` | route | request-response | `auth/logout.ts` | exact |
| `apps/server/src/index.ts` | config | — | same file (register routes) | exact |
| `apps/web/src/lib/roster.ts` | utility | request-response | `apps/web/src/lib/qbank.ts` | exact |
| `apps/web/src/pages/StudentLogin.tsx` | component | request-response | `AdminLogin.tsx` | role-match |
| `apps/web/src/pages/StudentWaiting.tsx` | component | request-response | `AdminDashboard.tsx` (read-only card layout) | partial |
| `apps/web/src/pages/AdminRoster.tsx` | component | CRUD + file-I/O | `AdminQuestions.tsx` | exact |
| `apps/web/src/components/auth/StudentRoute.tsx` | middleware (UI) | request-response | `AdminRoute.tsx` | exact |
| `apps/web/src/components/admin/roster/*` | component | file-I/O | `components/admin/qbank/*` | exact |
| `apps/web/src/pages/Home.tsx` | component | — | replace with redirect/login flow | modify |
| `apps/web/src/router.tsx` | route | — | same file | exact |
| `apps/web/src/pages/AdminDashboard.tsx` | component | — | 题库 card `Link` pattern | exact |
| `apps/web/src/contexts/StudentAuthContext.tsx` *(if added)* | provider | request-response | `AuthContext.tsx` | role-match |
| `apps/server/src/lib/roster/national-id.test.ts` *(recommended)* | test | transform | *(no server unit tests in repo yet)* | none |

## Pattern Assignments

### `prisma/schema.prisma` (model, CRUD)

**Analog:** `QuestionImportBatch` + `Question` + `Teacher` relation

**Batch + nested entries** (lines 32-44, 46-63):

```prisma
model QuestionImportBatch {
  id            String     @id @default(cuid())
  teacherId     String
  teacher       Teacher    @relation(fields: [teacherId], references: [id])
  fileName      String
  totalRows     Int
  importedCount Int
  skippedCount  Int        @default(0)
  createdAt     DateTime   @default(now())
  questions     Question[]

  @@index([teacherId])
}
```

**Teacher relation extension** (line 19):

```prisma
questionImportBatches  QuestionImportBatch[]
```

Mirror for `RosterImportBatch` / `RosterEntry` with `@@unique([fullName, nationalId])` per RESEARCH.

---

### `apps/server/src/lib/roster/types.ts` (utility, transform)

**Analog:** `apps/server/src/lib/qbank/types.ts`

**Error class + row error shape** (lines 3-21):

```typescript
export type QbankErrorCode =
  | 'INVALID_TEMPLATE'
  | 'ROW_LIMIT_EXCEEDED'
  | 'VALIDATION_ERROR';

export class QbankTemplateError extends Error {
  readonly code: QbankErrorCode;
  // ...
}

export type RowError = {
  row: number;
  column?: string;
  message: string;
};
```

**Constants** (lines 55-61):

```typescript
export const REQUIRED_HEADERS = ['题干', '题型', '答案'] as const;
export const MAX_IMPORT_ROWS = 2000;
export const SHEET_NAME = '题库导入';
```

Roster: `REQUIRED_HEADERS = ['姓名', '身份证号']`, `SHEET_NAME = '名单导入'`, `MAX_ROSTER_IMPORT_ROWS = 2000`.

---

### `apps/server/src/lib/roster/parse-workbook.ts` (utility, file-I/O)

**Analog:** `apps/server/src/lib/qbank/parse-workbook.ts`

**cellText — critical for 18-digit IDs** (lines 30-40):

```typescript
function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value == null) return '';
  if (typeof cell.value === 'object' && 'text' in cell.value) {
    return String(cell.value.text ?? '').trim();
  }
  // richText branch...
  return String(cell.value).trim();
}
```

**Sheet + header validation** (lines 79-93):

```typescript
const sheet = workbook.getWorksheet(SHEET_NAME);
if (!sheet) {
  throw new QbankTemplateError('INVALID_TEMPLATE', `缺少工作表「${SHEET_NAME}」`);
}
const headerRow = sheet.getRow(1);
const headerToCol = normalizeHeaderRow(headerRow);
assertRequiredHeaders(headerToCol);
```

**Example row skip** (lines 116-118):

```typescript
if (stem.startsWith('【示例】')) {
  skippedExampleCount += 1;
  return;
}
```

Roster: skip when `fullName.startsWith('【示例】')` on 姓名 column.

---

### `apps/server/src/lib/roster/validate-rows.ts` (utility, transform)

**Analog:** `apps/server/src/lib/qbank/validate-rows.ts`

**Per-row validate → accumulate errors** (lines 19-30, 148-162):

```typescript
function validateRow(row: RawRow): { question?: ParsedQuestion; errors: RowError[] } {
  const errors: RowError[] = [];
  // push { row, column, message }
  if (errors.length > 0) return { errors };
  return { question, errors: [] };
}

export function validateRows(rows: RawRow[]): ValidateRowsResult {
  const questions: ParsedQuestion[] = [];
  const errors: RowError[] = [];
  for (const row of rows) {
    const result = validateRow(row);
    if (result.errors.length > 0) errors.push(...result.errors);
    else if (result.question) questions.push(result.question);
  }
  return { questions, errors };
}
```

Add: `isValidNationalIdFormat`, batch-internal duplicate `Map`, optional `findMany` for DB duplicates before import.

---

### `apps/server/src/lib/roster/import-roster.ts` (service, batch)

**Analog:** `apps/server/src/lib/qbank/import-questions.ts`

**Single `$transaction` nested create** (lines 24-55):

```typescript
const batch = await prisma.$transaction(
  async (tx) => {
    return tx.questionImportBatch.create({
      data: {
        teacherId,
        fileName,
        totalRows: questions.length,
        importedCount: questions.length,
        skippedCount,
        questions: {
          create: questions.map((q) => ({ /* fields */ })),
        },
      },
    });
  },
  { timeout: 30_000 },
);
```

---

### `apps/server/src/lib/roster/national-id.ts` (utility, transform)

**Analog:** None in codebase — use RESEARCH GB 11643 excerpt; add first server unit test file in repo.

**Pattern from RESEARCH** (implement ~40 lines):

```typescript
const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const;
const CHECK_CHARS = '10X98765432';

export function isValidNationalIdFormat(id: string): boolean {
  if (id.length !== 18) return false;
  // body 17 digits; last [\dXx]; checksum compare last.toUpperCase() only for validity
}
```

**Do not** use checksum normalization for DB `===` match (D-03).

---

### `apps/server/src/lib/student-auth.ts` (utility, request-response)

**Analog:** `apps/server/src/lib/auth.ts` + `session.ts`

**Teacher session accessor** (`auth.ts` lines 12-14):

```typescript
export function getSessionTeacherId(request: FastifyRequest): string | undefined {
  return getRequestSession(request)?.teacherId;
}
```

**Student equivalents:** `getSessionRosterEntryId(request)` → `getRequestSession(request)?.studentRosterEntryId`; `establishStudentSession` / `regenerateStudentSession` / `destroyStudentSession` mutate the **same** `sid` session row (clear student fields on teacher login).

**Session getter** (`session.ts` lines 6-10):

```typescript
export function getRequestSession(request: FastifyRequest): AppSession | undefined {
  return request.raw.session;
}
```

---

### `apps/server/src/plugins/session.ts` (middleware, request-response)

**Analog:** Current single `session()` mount (lines 50-64)

```typescript
app.use(
  session({
    name: 'sid',
    secret: sessionSecret(),
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieSecure(),
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);
```

**Current (2026-05-17):** single `session({ name: 'sid', store, resave: false, saveUninitialized: false })`; student fields on same `SessionData`. ~~**Obsolete plan:** chain `student_sid`~~ — removed (unreliable PG persistence).

---

### `apps/server/src/plugins/student-guard.ts` (middleware, request-response)

**Analog:** `apps/server/src/plugins/admin-guard.ts`

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
  // mustChangePassword check...
}
```

Student guard: check `studentRosterEntryId` only; no `mustChangePassword`.

---

### `apps/server/src/routes/api/admin/roster-import.ts` (route, file-I/O)

**Analog:** `apps/server/src/routes/api/admin/questions-import.ts`

**Imports + route shell** (lines 1-10, 28-41):

```typescript
import { getSessionTeacherId } from '../../../lib/auth.js';
import { parseWorkbook } from '../../../lib/qbank/parse-workbook.js';
import { assertValidXlsxUpload } from '../../../lib/qbank/xlsx-file.js';
import { requireAdminSession } from '../../../plugins/admin-guard.js';

app.post('/api/admin/questions/import', {
  preHandler: requireAdminSession,
  config: {
    rateLimit: {
      max: Number(process.env.IMPORT_RATE_LIMIT_MAX ?? 10),
      timeWindow: '1 minute',
    },
  },
}, async (request, reply) => { /* ... */ });
```

**Multipart pipeline** (lines 48-77):

```typescript
const data = await request.file();
const buffer = await data.toBuffer();
const fileCheck = assertValidXlsxUpload(data.filename, data.mimetype, buffer);
// parseWorkbook → validateRows → if (errors.length) 400 { ok: false, errors }
// else importRoster(prisma, { teacherId, fileName, entries, skippedCount })
```

Reuse `assertValidXlsxUpload` from `lib/qbank/xlsx-file.ts` (no move required).

---

### `apps/server/src/routes/api/admin/roster-template.ts` (route, file-I/O)

**Analog:** `apps/server/src/routes/api/admin/questions-template.ts`

```typescript
const TEMPLATE_FILENAME = '题库导入模板.xlsx';
const TEMPLATE_DISPOSITION =
  "attachment; filename*=UTF-8''%E9%A2%98%E5%BA%93%E5%AF%BC%E5%85%A5%E6%A8%A1%E6%9D%BF.xlsx";

app.get('/api/admin/questions/template', { preHandler: requireAdminSession }, async (_request, reply) => {
  const templatePath = join(getRepoRoot(), 'docs/templates', TEMPLATE_FILENAME);
  return reply
    .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('Content-Disposition', TEMPLATE_DISPOSITION)
    .send(createReadStream(templatePath));
});
```

Roster: `名单导入模板.xlsx` + UTF-8 `filename*` for 名单导入模板.xlsx.

---

### `apps/server/src/routes/api/admin/roster-list.ts` (route, CRUD)

**Analog:** `apps/server/src/routes/api/admin/questions-list.ts`

**Zod query + pagination** (lines 7-12, 21-61):

```typescript
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // roster: query: z.string().optional() for name/id search
});

const [total, items] = await Promise.all([
  prisma.question.count({ where }),
  prisma.question.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { /* fields */ },
  }),
]);

return reply.send({ ok: true, page, pageSize, total, items });
```

Search: `OR` on `fullName` / `nationalId` with trimmed `query`.

---

### `apps/server/src/routes/api/student/verify.ts` (route, request-response)

**Analog:** `apps/server/src/routes/api/auth/login.ts`

**Rate limit** (lines 39-47):

```typescript
app.post('/api/auth/login', {
  config: {
    rateLimit: {
      max: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 15),
      timeWindow: '1 minute',
    },
  },
}, async (request, reply) => { /* ... */ });
```

**Zod body + uniform failure** (lines 12-15, 50-79):

```typescript
const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});
// ...
return reply.status(401).send({
  code: INVALID_CREDENTIALS_CODE,
  message: AUTH_ERROR_MESSAGE,
});
```

**Session regenerate on success** (lines 17-33, 82-87):

```typescript
await regenerateSession(request);
session.teacherId = teacher.id;
```

Student: `STUDENT_VERIFY_RATE_LIMIT_MAX`; 400 for format (`VALIDATION_ERROR`); 401 `INVALID_STUDENT_CREDENTIALS` + `STUDENT_AUTH_ERROR_MESSAGE` from `lib/errors.ts` (mirror `AUTH_ERROR_MESSAGE`).

---

### `apps/server/src/routes/api/student/me.ts` (route, request-response)

**Analog:** `apps/server/src/routes/api/auth/me.ts`

```typescript
app.get('/api/auth/me', async (request, reply) => {
  const user = await loadSessionUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send(user);
});
```

Student: `requireStudentSession`; load `RosterEntry` by `studentRosterEntryId`; return `{ fullName, nationalId }` (D-07).

---

### `apps/server/src/routes/api/student/logout.ts` (route, request-response)

**Analog:** `apps/server/src/routes/api/auth/logout.ts`

```typescript
function destroySession(request: FastifyRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = getRequestSession(request);
    if (!session) { resolve(); return; }
    session.destroy((err) => { /* ... */ });
  });
}

app.post('/api/auth/logout', async (request, reply) => {
  await destroySession(request);
  return reply.send({ ok: true });
});
```

Use `destroyStudentSession` — deletes `studentRosterEntryId` / `studentName` on unified session and `saveSession` (does not destroy teacher `teacherId`).

---

### `apps/server/src/index.ts` (config)

**Analog:** existing registrations (lines 21-30)

```typescript
await app.register(sessionPlugin);
await app.register(rateLimit, { global: false });
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
await registerAuthRoutes(app);
await registerAdminQuestionsTemplateRoutes(app);
await registerAdminQuestionsImportRoutes(app);
// add: roster + student route registrars
```

---

### `apps/web/src/lib/roster.ts` (utility, request-response)

**Analog:** `apps/web/src/lib/qbank.ts`

**Template download** (lines 82-104):

```typescript
export async function downloadQuestionTemplate(): Promise<void> {
  const response = await fetch('/api/admin/questions/template', { credentials: 'include' });
  // 401 toast; blob + anchor.download
}
```

**Multipart import** (lines 106-152):

```typescript
const form = new FormData();
form.append('file', file);
const response = await fetch('/api/admin/questions/import', { method: 'POST', body: form, credentials: 'include' });
if (response.status === 400 && Array.isArray(payload.errors)) {
  return { ok: false, errors: payload.errors as ImportRowError[] };
}
```

**List fetch** (lines 154-186): `apiFetch` with `URLSearchParams` for page/pageSize/query.

Add `studentApi.verify`, `studentApi.me`, `studentApi.logout` using `apiFetch` with `skipAuthRedirect: true` where appropriate.

---

### `apps/web/src/pages/StudentLogin.tsx` (component, request-response)

**Analog:** `apps/web/src/pages/AdminLogin.tsx`

**Form + zod + ApiError 401** (lines 32-74):

```typescript
const loginSchema = z.object({
  username: z.string().trim().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

async function onSubmit(values: LoginValues) {
  try {
    const user = await authApi.login(values.username, values.password);
    navigate(target, { replace: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      setFormError(INVALID_CREDENTIALS_MESSAGE);
      return;
    }
    setFormError('无法连接服务器，请检查网络或联系机房管理员。');
  }
}
```

Fields: `fullName`, `nationalId` (plain `Input`, not `PasswordInput`); card title「学生登录」; success → `/exam/waiting`.

---

### `apps/web/src/pages/StudentWaiting.tsx` (component, request-response)

**Analog:** `AdminDashboard.tsx` welcome + `Card` (lines 17-71); data from `GET /api/student/me`

**Card layout** (`AdminDashboard.tsx` lines 36-57):

```tsx
<Card className={cn(href ? 'transition-colors hover:border-primary/50' : 'cursor-not-allowed opacity-60')}>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

Display full name + national ID + fixed copy「请等待监考教师开始考试」; **退出** button like `AdminLayout` logout (lines 10-16).

---

### `apps/web/src/pages/AdminRoster.tsx` (component, CRUD + file-I/O)

**Analog:** `apps/web/src/pages/AdminQuestions.tsx`

**State + import handlers** (lines 48-113):

```typescript
const [importSuccess, setImportSuccess] = useState<ImportSuccess | null>(null);
const [importFailure, setImportFailure] = useState<ImportFailure | null>(null);
const [items, setItems] = useState<QuestionListItem[]>([]);
const loadList = useCallback(async (targetPage = page) => { /* fetch */ }, [deps]);

function handleImportSuccess(result: ImportSuccess) {
  setImportFailure(null);
  toast.success(`已成功导入 ${result.importedCount} 道题目。`);
  void loadList(1, { /* batch filter */ });
}
```

Compose: `ImportDropzone` / `ImportErrorTable` / `ImportResultSummary` from `components/admin/roster/` (copy qbank components).

---

### `apps/web/src/components/auth/StudentRoute.tsx` (middleware UI)

**Analog:** `apps/web/src/components/auth/AdminRoute.tsx`

```typescript
const PUBLIC_ADMIN_PATHS = ['/admin/login'];

export function AdminRoute() {
  const { status } = useAuth();
  if (status === 'checking') return <AuthChecking />;
  if (status === 'unauthenticated' && !isPublic) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?redirect=${redirect}`} replace />;
  }
  return <Outlet />;
}
```

Student: `PUBLIC_STUDENT_PATHS = ['/exam/login']`; check student session via `studentApi.me` or dedicated context; authenticated on login → redirect away from login to `/exam/waiting`.

---

### `apps/web/src/components/admin/roster/*` (component, file-I/O)

**Analog:** `apps/web/src/components/admin/qbank/ImportDropzone.tsx`, `ImportErrorTable.tsx`, `ImportResultSummary.tsx`

**Dropzone props** (`ImportDropzone.tsx` lines 14-24):

```typescript
type ImportDropzoneProps = {
  onSuccess: (result: ImportSuccess) => void;
  onFailure: (result: ImportFailure) => void;
  disabled?: boolean;
};
```

Wire to `downloadRosterTemplate` / `importRosterFile` from `@/lib/roster`.

---

### `apps/web/src/router.tsx` (route)

**Analog:** existing `/admin` nested routes (lines 19-33)

```tsx
<Route path="/" element={<Home />} />
<Route path="/admin" element={<AdminRoute />}>
  <Route element={<RequireAuthenticatedAdmin />}>
    <Route element={<AdminLayout />}>
      <Route path="questions" element={<AdminQuestions />} />
    </Route>
  </Route>
</Route>
```

Add parallel:

```tsx
<Route path="/exam" element={<StudentRoute />}>
  <Route path="login" element={<StudentLogin />} />
  <Route element={<RequireStudentSession />}>
    <Route path="waiting" element={<StudentWaiting />} />
  </Route>
</Route>
<Route path="/admin/roster" element={...} />  // under AdminLayout
```

---

### `apps/web/src/pages/AdminDashboard.tsx` (component, modify)

**Analog:** 题库 card with `href` (lines 8-11, 60-65)

```typescript
const PLACEHOLDER_CARDS = [
  { title: '题库', icon: BookOpen, href: '/admin/questions' as const },
  { title: '名单', icon: Users },
];
// ...
if (href) {
  return (
    <Link key={title} to={href} className="rounded-xl outline-none">
      {card}
    </Link>
  );
}
```

Add `href: '/admin/roster'` to 名单 card; remove `opacity-60` / `即将开放`.

---

### `apps/web/src/pages/Home.tsx` (component, modify)

**Analog:** minimal placeholder (current file)

Replace with `<Navigate to="/exam/login" replace />` or student session-aware redirect to `/exam/waiting`.

---

## Shared Patterns

### Authentication (teacher admin API)

**Source:** `apps/server/src/plugins/admin-guard.ts`  
**Apply to:** All `/api/admin/roster/*`

```typescript
export async function requireAdminSession(request, reply) {
  const teacherId = getSessionTeacherId(request);
  if (!teacherId) return reply.status(401).send({ error: 'Unauthorized' });
  // loadSessionUser + mustChangePassword
}
```

### Authentication (student API)

**Source:** New `student-guard.ts` modeled on admin-guard  
**Apply to:** `GET /api/student/me`, `POST /api/student/logout`

### Uniform auth failure messages

**Source:** `apps/server/src/lib/errors.ts`

```typescript
export const AUTH_ERROR_MESSAGE =
  '用户名或密码错误，请检查后重试。' as const;
export const INVALID_CREDENTIALS_CODE = 'INVALID_CREDENTIALS' as const;
```

Add `STUDENT_AUTH_ERROR_MESSAGE` + `INVALID_STUDENT_CREDENTIALS` for roster verify 401.

### Excel upload validation

**Source:** `apps/server/src/lib/qbank/xlsx-file.ts`  
**Apply to:** `roster-import.ts`

```typescript
export function assertValidXlsxUpload(filename, mimetype, buffer) {
  if (!isXlsxExtension(filename)) return { ok: false, message: '请上传 .xlsx 文件' };
  if (!isXlsxMime(mimetype)) return { ok: false, message: '文件类型无效' };
  if (!hasZipMagic(buffer)) return { ok: false, message: '文件内容不是有效的 Excel 工作簿' };
  return { ok: true };
}
```

### Client API + cookies

**Source:** `apps/web/src/lib/api.ts`

```typescript
const response = await fetch(path, {
  ...init,
  credentials: 'include',
  headers,
});
```

Student calls use `credentials: 'include'` for the same `sid` cookie; use `skipAuthRedirect: true` on `studentApi.*` so 401 does not trigger teacher session-expired handler (`apps/web/src/lib/student.ts`).

### Import ALL_OR_NOTHING response

**Source:** `questions-import.ts` lines 75-77

```typescript
if (errors.length > 0) {
  return reply.status(400).send({ ok: false, errors });
}
```

### Logging (no PII)

**Source:** `login.ts` lines 69-75

```typescript
request.log.warn({ event: 'auth_login_failed', username }, 'Login failed');
```

Student verify: `event: 'student_verify_failed'` only — **no** full national ID in logs.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/roster/national-id.ts` | utility | transform | GB 11643 checksum not in repo; use RESEARCH code + new unit test |
| `lib/roster/national-id.test.ts` | test | transform | No `*.test.ts` in monorepo yet; establish pattern with vitest/jest if configured in plan |
| Dual `express-session` chain | middleware | request-response | Only single session today; RESEARCH Pattern 3 — integration test required |
| `StudentAuthContext.tsx` | provider | request-response | Optional; if omitted, inline `studentApi.me` in `StudentRoute` like early auth patterns |

## Metadata

**Analog search scope:** `apps/server/src/`, `apps/web/src/`, `prisma/`, `docs/templates/`  
**Files scanned:** 26 server + 32 web source files  
**Pattern extraction date:** 2026-05-16

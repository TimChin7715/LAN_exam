# Phase 5: 导出汇总逐题得分 - Research

**Researched:** 2026-05-17  
**Domain:** ExcelJS wide-table export extension, per-question score pivot, summary/detail consistency testing  
**Confidence:** HIGH（实现面窄、栈与 Phase 4 导出已落地）；MEDIUM（校方 fixture 尚未入库、纯函数拆分粒度由 plan 定案）

## Summary

Phase 5 在 **不改动 API 与「答题明细」表** 的前提下，仅扩展 `buildExamExportWorkbook` 内 **「成绩汇总」** 工作表：固定前 5 列后，按当次考试 `ExamQuestion`（`sortOrder` 升序）追加 **「第1题」…「第N题」** 列。已提交考生各题格写入 `Answer.pointsAwarded`（与明细「得分」同源）；未提交考生总分与各题均为 **「—」**；已提交但某题无 `Answer` 行（异常数据）显示 **`0`**。

当前 `export-workbook.ts` 已通过 `rosterEntries` 查询带出 `submission.answers` 及 `examQuestion.sortOrder`，但汇总表仅 5 列。**必须** 额外（或合并）加载 **`examId` 下全部 `ExamQuestion`** 以确定 N 与表头顺序——不能仅从已有 answers 推导 N（无提交或空考场时 N 仍须正确）。`submit.ts` 在提交时为 **每道** `ExamQuestion` 创建 `Answer`（未作答 `pointsAwarded: 0`），故正常路径下 D-04 主要针对数据损坏/历史异常；实现仍应对缺行显式 `0`。

**Primary recommendation:** 单独 `findMany` `ExamQuestion` → 构建 `summarySheet.columns = fixed5 + dynamicN` → 每行用 `Map<examQuestionId, pointsAwarded>` 填充分数列 → 将 pivot/行构建提取为 **可单测纯函数** → `export-workbook.test.ts` 用内存 Workbook 往返 + 汇总/明细一致性断言；Wave 0 入库 `fixtures/export/test1-成绩导出.xlsx` 做表头结构 smoke。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 逐题得分列定义（N、表头、顺序） | API / Backend | — | 权威题序来自 `ExamQuestion.sortOrder` |
| 宽表行填充（已提交/未提交/缺答） | API / Backend | — | 与 D-02～D-05 契约在服务端兑现 |
| 答题明细长表（不变） | API / Backend | — | EXPR-04：复用现有 L119–138 逻辑，勿改列 |
| 汇总↔明细一致性 | API / Backend（导出时同源数据） | 自动化测试 | D-08：同一次 `buildExamExportWorkbook` 输出内校验 |
| xlsx 生成与下载 | API / Backend（exceljs） | Browser 下载 | 与 Phase 4 相同，`exams-export.ts` 不变 |
| 证号脱敏 | API / Backend | — | 仍用 `maskNationalId`，无新 PII 面 |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 表头为 **「第1题」「第2题」…「第N题」**，题序与 v1.0 明细表一致：`ExamQuestion.sortOrder + 1`。
- **D-02:** **已提交** 考生：各题列写入该题 `pointsAwarded`（与「答题明细」同题「得分」**必须一致**）。
- **D-03:** **未提交** 考生：总分与各题得分列均为 **「—」**（与 v1.0 EXPR-01 一致）；是否提交为「未提交」。
- **D-04:** **已提交但某题无 `Answer` 行**（未作答）：该题汇总列显示 **`0`**（不答题按零分计，与答错得 0 分在表上同为 `0`）。
- **D-05:** 得分列 **允许小数**；得分为 0 时 **显式写入 `0`**（不用留空表示零分）。
- **D-06:** **不** 为汇总宽表增加冻结窗格、特殊列宽或 WPS 浏览优化；表结构以满足 **导入外系统** 为准（用户明确不需可读性增强）。
- **D-07:** 验收以校方样例 **`test1-成绩导出.xlsx`** 的「成绩汇总」宽表用法为对照；样例文件纳入仓库 fixture（见 canonical refs），供人工对照与自动化回归。
- **D-08:** 增加 **自动化测试**：生成导出后，对每个已提交考生校验汇总表「第k题」列与「答题明细」中同考生、同题号行的「得分」一致；并覆盖未提交行各题为「—」、缺答题为 `0` 等契约。

### Claude's Discretion

- 0 题考试（N=0）时仅保留前 5 列、无动态题列——按实现自然行为处理，无需单独讨论。
- 从 DB 组装宽表时是否先按 `examId` 加载全部 `ExamQuestion` 再 pivot，或沿用现有 `rosterEntries` 查询结构——由 plan/execute 按性能与清晰度选型。
- Fixture 路径与测试是否解析 xlsx 二进制或仅测 `buildExamExportWorkbook` 内存结构——由 planner 在 PLAN 中定案，须满足 D-07/D-08。

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPR-03 | 「成绩汇总」在固定 5 列后按题号追加「第1题」…「第N题」；已提交显示 `pointsAwarded`，未提交各题为「—」 | 动态 `worksheet.columns` + `ExamQuestion` 查询 + 行内 Map pivot（见 Architecture Patterns） |
| EXPR-04 | 「答题明细」长表与 v1.0 一致 | 不修改 detail 循环；测试加回归断言列数/表头不变 |
</phase_requirements>

## Project Constraints (from .cursor/rules/)

- **`.cursor/rules/`：** 仓库内 **未发现** `.cursor/rules/` 目录（`config.json` 中 `claude_md_path` 指向 `./.cursor/rules/` 但目录为空/缺失）。[VERIFIED: Glob 2026-05-17]
- **GSD / 合规：** 遵循 `PROJECT.md` — 导出证号脱敏；日志禁止完整证号（Phase 4 已建立）。[VERIFIED: `PROJECT.md`, `04-SECURITY.md`]
- **测试惯例：** `node:test` + `tsx`，共置 `*.test.ts`，优先纯函数单测、不 mock Prisma。[VERIFIED: `.planning/codebase/TESTING.md`]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| exceljs | **4.4.0** | 扩展汇总列、可选 fixture 解析 | 项目已用；Phase 4 导出同库 [VERIFIED: `npm view exceljs` + `apps/server/package.json`] |
| @prisma/client | **6.8.2** | 加载 `ExamQuestion`、`Submission`、`Answer` | 现有 `export-workbook.ts` 模式 [VERIFIED: `apps/server/package.json`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:test + tsx | (Node 内置 + devDep) | D-08 自动化 | 与 `score-question.test.ts` 一致 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 内存 Workbook 断言 | 仅 E2E 下载 xlsx 人工核对 | 无法满足 D-08 回归；慢且脆 |
| 从 answers 推导 N | 独立 `ExamQuestion.findMany` | 无提交时 N 错误；题序不可靠 |
| 修改明细表补全未答行 | 保持 v1.0 明细语义 | EXPR-04 禁止；且 submit 已全量建 Answer |

**Installation:** 无新依赖。

**Version verification:** `npm view exceljs version` → **4.4.0**（2026-05-17）[VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```
GET /api/admin/exams/:id/export
        │
        ▼
buildExamExportWorkbook(examId)
        │
        ├─► prisma.exam.findUnique (rosterBatchId)
        ├─► prisma.examQuestion.findMany ──► N, headers「第k题」
        ├─► prisma.rosterEntry.findMany + submissions.answers
        │
        ├─► Sheet「成绩汇总」
        │     fixed 5 cols + N score cols
        │     per row: submitted? ──no──► all scores「—」
        │              └──yes──► Map(examQuestionId → pointsAwarded); missing → 0
        │
        └─► Sheet「答题明细」(unchanged)
              submitted only, 1 row per Answer
        │
        ▼
workbook.xlsx.writeBuffer() → HTTP attachment
```

### Recommended Project Structure

```
apps/server/src/lib/exam/
├── export-workbook.ts          # modify: summary columns + rows
├── export-summary.ts           # optional: pure pivot/helpers (planner choice)
├── export-workbook.test.ts     # new: D-08
└── mask-national-id.ts         # unchanged

fixtures/export/
└── test1-成绩导出.xlsx         # Wave 0: D-07 校方样例（当前未入库）
```

### Pattern 1: Load ExamQuestion for column schema

**What:** 在构建汇总表前查询当次考试全部题目，按 `sortOrder: 'asc'` 排序。  
**When to use:** 始终——表头与列数仅由此决定。  
**Why not answers-only:** 名单内无人提交时仍须导出正确 N 列；题序必须与明细 `sortOrder + 1` 一致。

```typescript
// Recommended query (can merge into exam findUnique or parallel Promise.all)
const examQuestions = await prisma.examQuestion.findMany({
  where: { examId },
  orderBy: { sortOrder: 'asc' },
  select: { id: true, sortOrder: true },
});
const N = examQuestions.length;
```

[VERIFIED: `prisma/schema.prisma` ExamQuestion.sortOrder; `export-workbook.ts` detail uses `sortOrder + 1`]

### Pattern 2: Dynamic summary columns (ExcelJS)

**What:** 将固定 5 列与 N 个得分列拼成 `worksheet.columns`，再用 `addRow` 按 key 填值。  
**When to use:** N 随考试变化时（本阶段核心）。

```typescript
// Source: [CITED: Context7 /exceljs/exceljs — worksheet.columns, addRow]
const fixed = [
  { header: '姓名', key: 'name', width: 16 },
  { header: '身份证号', key: 'id', width: 22 },
  { header: '总分', key: 'score', width: 10 },
  { header: '是否提交', key: 'submitted', width: 12 },
  { header: '提交时间', key: 'time', width: 20 },
] as const;

const perQuestion = examQuestions.map((eq) => ({
  header: `第${eq.sortOrder + 1}题`,
  key: `q_${eq.id}`, // stable key; NOT sortOrder (gaps possible)
  width: 10,
}));

summarySheet.columns = [...fixed, ...perQuestion];
summarySheet.getRow(1).font = { bold: true };
```

**Cell values:**

| 状态 | 总分 | 第k题列 |
|------|------|---------|
| 未提交 | `—` | `—` (D-03) |
| 已提交 | `submission.totalScore` (number) | `pointsAwarded` or `0` if no Answer (D-04) |
| 得 0 分 | number `0` | number `0`，非空单元格 (D-05) |

**D-05 / 小数：** Prisma `Answer.pointsAwarded` 与 `Submission.totalScore` 均为 **`Int`** [VERIFIED: `schema.prisma`]。当前计分仅整数；写入 Excel 时用 **number** 类型（`0` 而非 `''`）。若未来改为 Decimal，ExcelJS 仍接受 number——无需本阶段改 schema。

```typescript
function scoreByQuestionId(
  answers: { examQuestionId: string; pointsAwarded: number }[],
): Map<string, number> {
  return new Map(answers.map((a) => [a.examQuestionId, a.pointsAwarded]));
}

// Per roster row (submitted):
const byQ = scoreByQuestionId(submission.answers);
const row: Record<string, string | number> = { /* fixed fields */ };
for (const eq of examQuestions) {
  row[`q_${eq.id}`] = byQ.get(eq.id) ?? 0; // D-04
}
```

[VERIFIED: `submit.ts` L61–88 creates Answer for every ExamQuestion; empty draft → `pointsAwarded: 0` via `scoreQuestion`]

### Pattern 3: Detail sheet — do not touch

**What:** `detailSheet` 的 `columns` 与 `for (const answer of sortedAnswers)` 循环保持 Phase 4 行为。  
**Verification:** 测试断言表头仍为 8 列、工作表名「答题明细」；已提交行数 = 提交人数 × N（抽样或小型 fixture）。

### Pattern 4: Testability — extract pure pivot (recommended)

**What:** 将「给定 `examQuestions` + `submission | null` → 各题得分数组/对象」提取为纯函数（如 `buildSummaryQuestionCells`），`export-workbook.ts` 只负责 Prisma 与 ExcelJS。  
**When to use:** 满足 D-08 且符合 `TESTING.md`（不 mock Prisma）。  
**Example test flow:**

1. 构造内存 `examQuestions` + 假 `submission.answers`
2. 调用纯函数 → 断言 `['—',…]` / `[2,0,5]` / 缺答 `0`
3. 可选：用合成数据调用内部 `fillSummarySheet` → `writeBuffer` → `load` → 读第 1 行表头与某数据行

**汇总 vs 明细一致性（D-08）：**

```typescript
// After build (in-memory, synthetic data injected OR full integration with test DB — prefer in-memory helper)
const summary = workbook.getWorksheet('成绩汇总')!;
const detail = workbook.getWorksheet('答题明细')!;

// For each submitted student name:
//   summary col「第k题」 === detail row where 题号=k and 姓名=name, column「得分」
```

索引方式：明细用 **题号**（`sortOrder + 1`）与汇总 **「第k题」** 对齐，勿用列下标硬编码 N。

### Anti-Patterns to Avoid

- **从首个 submission 的 answers 推断 N：** 无人提交时列数错误。
- **用 `sortOrder` 作 column `key`：** `sortOrder` 不保证连续；用 `examQuestionId`。
- **未提交行题列写 `0` 或留空：** 违反 D-03，须全部为 `—`。
- **修改明细表列或给未答题补行：** 违反 EXPR-04；正常数据 submit 已全量 Answer。
- **日志输出 `nationalId`：** 延续 Phase 4 禁令。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| xlsx 读写 | 自研 OOXML | exceljs 已有 | 项目标准；中文表名已验证 |
| 逐题得分计算 | 导出时重算 | 读 `Answer.pointsAwarded` | 与明细同源；计分在 `submit.ts` |
| CSV 宽表 | 额外格式 | 保持单 xlsx 双表 | EXPR-04 / v1.1 Out of Scope |
| 证号脱敏 | 新规则 | `maskNationalId` | 合规一致 |

## Common Pitfalls

### Pitfall 1: Summary/detail score drift

**What goes wrong:** 汇总列用 `totalScore/N` 或重算，与明细「得分」不一致。  
**Why it happens:** 重复计分逻辑或题序不一致。  
**How to avoid:** 汇总题列 **仅** 读 `pointsAwarded`；题序 **仅** 来自 `ExamQuestion.sortOrder`；D-08 自动化对账。  
**Warning signs:** 某生总分等于题列之和但明细单行不符。

### Pitfall 2: Unsubmitted row shows 0 for questions

**What goes wrong:** 未提交行题列为 `0` 或空。  
**Why it happens:** 与总分列共用 `submission ? score : '—'` 分支时漏题列。  
**How to avoid:** 未提交时 **整段** 题列循环填 `—`，不读 submission。  
**Warning signs:** 是否提交=「未提交」但第1题为 0。

### Pitfall 3: ExcelJS column keys vs addRow

**What goes wrong:** 动态列未出现在导出文件。  
**Why it happens:** `addRow` 对象缺少 `key` 或与 `columns[].key` 不匹配。  
**How to avoid:** 先设 `worksheet.columns`，再 `addRow` 带齐所有 `q_${id}` keys。  
**Warning signs:** 表头有「第1题」但数据列全空。

### Pitfall 4: Missing fixture blocks D-07

**What goes wrong:** `fixtures/export/test1-成绩导出.xlsx` 不存在，验收无对照。  
**Status:** **当前未入库** [VERIFIED: Glob 2026-05-17]  
**How to avoid:** Plan Wave 0 任务：从校方获取并提交；结构测试 `skip` 若文件缺失并文档化。

## Code Examples

### Dynamic summary columns + row

```typescript
// Source: [CITED: Context7 /exceljs/exceljs — columns, addRow]
// Pattern only — integrate into export-workbook.ts

summarySheet.columns = [
  { header: '姓名', key: 'name', width: 16 },
  { header: '身份证号', key: 'id', width: 22 },
  { header: '总分', key: 'score', width: 10 },
  { header: '是否提交', key: 'submitted', width: 12 },
  { header: '提交时间', key: 'time', width: 20 },
  ...examQuestions.map((eq) => ({
    header: `第${eq.sortOrder + 1}题`,
    key: `q_${eq.id}`,
    width: 10,
  })),
];

for (const entry of rosterEntries) {
  const submission = entry.submissions[0];
  const row: Record<string, string | number> = {
    name: entry.fullName,
    id: maskNationalId(entry.nationalId),
    score: submission ? submission.totalScore : '—',
    submitted: submission ? '已提交' : '未提交',
    time: submission ? formatDateTime(submission.submittedAt) : '',
  };
  if (!submission) {
    for (const eq of examQuestions) row[`q_${eq.id}`] = '—';
  } else {
    const byQ = new Map(
      submission.answers.map((a) => [a.examQuestion.id, a.pointsAwarded]),
    );
    for (const eq of examQuestions) {
      row[`q_${eq.id}`] = byQ.get(eq.id) ?? 0;
    }
  }
  summarySheet.addRow(row);
}
```

### Fixture header smoke (D-07)

```typescript
// Source: [CITED: exceljs README — xlsx.load; VERIFIED: qbank/parse-workbook.ts pattern]
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';

const buf = readFileSync('fixtures/export/test1-成绩导出.xlsx');
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
const sheet = wb.getWorksheet('成绩汇总');
const headers = sheet.getRow(1).values as (string | undefined)[];
// Assert headers[1]==='姓名', ... then 第1题, 第2题, ...
```

### Consistency helper (D-08)

```typescript
// Pure — test without DB
export function perQuestionScoresForSummary(
  examQuestions: { id: string; sortOrder: number }[],
  submission: { answers: { examQuestion: { id: string }; pointsAwarded: number }[] } | undefined,
): (number | '—')[] {
  if (!submission) return examQuestions.map(() => '—' as const);
  const byId = new Map(
    submission.answers.map((a) => [a.examQuestion.id, a.pointsAwarded]),
  );
  return examQuestions.map((eq) => byId.get(eq.id) ?? 0);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 汇总 5 列 | 汇总 5+N 列 | Phase 5 | 仅改 `export-workbook.ts` 汇总段 |
| 无 export 单测 | D-08 要求自动化 | Phase 5 | 新增 `export-workbook.test.ts` |

**Deprecated/outdated:** 无。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 校方 `test1-成绩导出.xlsx` 表头第 6 列起为「第1题」连续命名 | Fixture smoke | 需对照真实样例调整断言 |
| A2 | 正常提交总为每题一条 `Answer` | Pattern 2 | D-04 的 `?? 0` 仅覆盖异常；若业务变更需同步明细 |

**Note:** 若 fixture 与实现表头不一致，以 CONTEXT D-01 为准（「第k题」），fixture 测试记录差异供人工确认。

## Open Questions (RESOLVED)

1. **Fixture 文件来源与脱敏** — **RESOLVED:** `05-01-PLAN.md` Task 1 (human checkpoint) commits `fixtures/export/test1-成绩导出.xlsx` at exact path; operator redacts plaintext 18-digit IDs before commit; CI uses header-only smoke (D-07), not binary snapshots.

2. **Planner: 纯函数文件是否单独 `export-summary.ts`** — **RESOLVED:** Yes — `05-01-PLAN.md` Task 2 creates `export-summary.ts` with `perQuestionScoresForSummary` and `buildSummaryRowQuestionFields`; `export-workbook.ts` imports these helpers.

## Environment Availability

**Step 2.6: SKIPPED** — 无新外部依赖；沿用 Node、`tsx`、`exceljs`、现有 Postgres 开发环境（手动 UAT 时）。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| exceljs | xlsx 生成 | ✓ (declared) | 4.4.0 | — |
| node:test + tsx | D-08 | ✓ (repo pattern) | — | — |
| PostgreSQL | `buildExamExportWorkbook` 集成 | 开发/UAT 需要 | — | 单测用纯函数，不连 DB |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes (unchanged) | `requireAdminSession` on export route |
| V4 Access Control | yes (unchanged) | `exam.teacherId` match |
| V5 Input Validation | low (read-only export) | 无新用户输入 |
| V6 Cryptography | no new crypto | 脱敏展示，非加密 |
| Information disclosure | yes | `maskNationalId` on all export columns |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 导出明文证号 | Information disclosure | 继续 `maskNationalId` [VERIFIED: Phase 4] |
| 超大 xlsx 内存 | Denial of service | 保持 ~2000×200 注释；宽表略增列宽内存，可接受 [VERIFIED: `04-SECURITY.md` R-04-03-01] |
| 日志泄露证号 | Information disclosure | 禁止 log `nationalId` |

**Phase 5 delta:** 无新威胁面；列数增加仅略增 `writeBuffer` 体积。

## Sources

### Primary (HIGH confidence)

- [VERIFIED: `apps/server/src/lib/exam/export-workbook.ts`] — 当前 5 列汇总 + 明细实现
- [VERIFIED: `apps/server/src/lib/exam/submit.ts`] — 全量 `Answer` 创建
- [VERIFIED: `prisma/schema.prisma`] — `pointsAwarded Int`, `ExamQuestion.sortOrder`
- [VERIFIED: `npm view exceljs`] — 4.4.0
- [CITED: Context7 `/exceljs/exceljs`] — `worksheet.columns`, `addRow`, `xlsx.load`

### Secondary (MEDIUM confidence)

- [VERIFIED: `.planning/phases/05-export-summary-per-question/05-CONTEXT.md`] — D-01～D-08
- [VERIFIED: `.planning/codebase/TESTING.md`] — 单测惯例
- [VERIFIED: `.planning/phases/04-exam-submit-export/04-ACCEPTANCE.md`] — EXPR-01/02 基线

### Tertiary (LOW confidence)

- 校方样例列序 — 待 fixture 入库后验证（A1）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 无新库
- Architecture: HIGH — 单文件主改 + 明确数据流
- Pitfalls: HIGH — 契约来自 CONTEXT；submit 行为已核实
- Fixture: MEDIUM — 文件缺失

**Research date:** 2026-05-17  
**Valid until:** 2026-06-17（exceljs/Prisma 稳定）

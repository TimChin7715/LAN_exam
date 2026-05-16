# Phase 5: 导出汇总逐题得分 - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

在 v1.0 双表 xlsx 导出（`buildExamExportWorkbook`）基础上，扩展 **「成绩汇总」** 工作表：固定前 5 列（姓名、脱敏证号、总分、是否提交、提交时间）之后，按 `ExamQuestion.sortOrder` 递增追加 **「第1题」…「第N题」** 得分列（N = 当次考试题目数）。**「答题明细」** 长表工作表与 v1.0 列与行为 **不变**（EXPR-04）。

对应 ROADMAP Phase 5 成功标准与 `.planning/REQUIREMENTS.md` EXPR-03、EXPR-04。

本阶段 **不** 包含：汇总表增加题干/所选/对错列、统计概况表、CSV、拆分文件、明文证号导出、冻结窗格等 Excel 可读性优化（汇总表用于导入外系统）。
</domain>

<decisions>
## Implementation Decisions

### 逐题得分列（汇总宽表）

- **D-01:** 表头为 **「第1题」「第2题」…「第N题」**，题序与 v1.0 明细表一致：`ExamQuestion.sortOrder + 1`。
- **D-02:** **已提交** 考生：各题列写入该题 `pointsAwarded`（与「答题明细」同题「得分」**必须一致**）。
- **D-03:** **未提交** 考生：总分与各题得分列均为 **「—」**（与 v1.0 EXPR-01 一致）；是否提交为「未提交」。
- **D-04:** **已提交但某题无 `Answer` 行**（未作答）：该题汇总列显示 **`0`**（不答题按零分计，与答错得 0 分在表上同为 `0`）。
- **D-05:** 得分列 **允许小数**；得分为 0 时 **显式写入 `0`**（不用留空表示零分）。

### 导出格式与集成

- **D-06:** **不** 为汇总宽表增加冻结窗格、特殊列宽或 WPS 浏览优化；表结构以满足 **导入外系统** 为准（用户明确不需可读性增强）。
- **D-07:** 验收以校方样例 **`test1-成绩导出.xlsx`** 的「成绩汇总」宽表用法为对照；样例文件纳入仓库 fixture（见 canonical refs），供人工对照与自动化回归。
- **D-08:** 增加 **自动化测试**：生成导出后，对每个已提交考生校验汇总表「第k题」列与「答题明细」中同考生、同题号行的「得分」一致；并覆盖未提交行各题为「—」、缺答题为 `0` 等契约。

### Claude's Discretion

- 0 题考试（N=0）时仅保留前 5 列、无动态题列——按实现自然行为处理，无需单独讨论。
- 从 DB 组装宽表时是否先按 `examId` 加载全部 `ExamQuestion` 再 pivot，或沿用现有 `rosterEntries` 查询结构——由 plan/execute 按性能与清晰度选型。
- Fixture 路径与测试是否解析 xlsx 二进制或仅测 `buildExamExportWorkbook` 内存结构——由 planner 在 PLAN 中定案，须满足 D-07/D-08。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and requirements

- `.planning/PROJECT.md` — v1.1 里程碑、导出合规（证号脱敏）
- `.planning/REQUIREMENTS.md` — EXPR-03、EXPR-04；v1.1 Out of Scope
- `.planning/ROADMAP.md` — Phase 5 目标与成功标准
- `.planning/phases/04-exam-submit-export/04-CONTEXT.md` — 导出域边界、Planner discretion 背景
- `.planning/phases/04-exam-submit-export/04-ACCEPTANCE.md` — EXPR-01/02 列定义、脱敏规则、未提交行语义
- `.planning/phases/04-exam-submit-export/04-SECURITY.md` — 导出规模上限注释（~2000×200）

### Implementation

- `apps/server/src/lib/exam/export-workbook.ts` — **主要修改点**
- `apps/server/src/lib/exam/mask-national-id.ts` — 证号脱敏（不变）
- `apps/server/src/routes/api/admin/exams-export.ts` — 下载路由（行为不变，文件名仍为 `*-成绩导出.xlsx`）
- `.planning/codebase/TESTING.md` — `node:test` + `tsx` 共置 `*.test.ts` 模式

### Reference fixture（验收对照）

- `fixtures/export/test1-成绩导出.xlsx` — **校方样例**（讨论锁定 D-07）；若执行前尚未入库，plan-phase 首任务为从校方获取并提交该文件，或记录等价路径。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/server/src/lib/exam/export-workbook.ts` — `buildExamExportWorkbook(examId)` 已加载 `submission.answers` 含 `pointsAwarded`、`examQuestion.sortOrder`；扩展汇总 `columns` 与行填充即可。
- `apps/server/src/lib/exam/score-question.ts` + `score-question.test.ts` — 计分契约（宽表只读已持久化 `pointsAwarded`）。
- Phase 4 明细表行构建逻辑（同文件 L119–138）— 题号、得分来源与汇总列须同源。

### Established Patterns

- ExcelJS 双工作表；表头第 1 行 `bold`；中文表名「成绩汇总」「答题明细」。
- 名单遍历：`rosterBatch` 下全部 `RosterEntry`，`orderBy: fullName asc`。
- 脱敏：导出列一律 `maskNationalId`；禁止日志打印完整证号。

### Integration Points

- 无新 API；`GET /api/admin/exams/:id/export` 仍调用 `buildExamExportWorkbook`。
- 前端 `apps/web/src/lib/exam.ts` 下载文件名不变。

</code_context>

<specifics>
## Specific Ideas

- 汇总表用途是 **导入另一个系统**，不是教师在 Excel 里浏览——故不做冻结/列宽优化（D-06）。
- 校方参考：`test1-成绩导出.xlsx` 宽表布局；自动化须证明汇总逐题分与明细「得分」一致（D-08）。

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-导出汇总逐题得分*
*Context gathered: 2026-05-17*

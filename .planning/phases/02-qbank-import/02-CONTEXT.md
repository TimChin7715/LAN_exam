# Phase 2: 题库导入 - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

教师通过 **约定 Excel 模板** 批量导入单选、多选、判断题；系统在管理端展示导入条数、错误报告与抽样预览，且非法文件不产生半条脏数据。对应 **QBANK-01**、**QBANK-02**、**QBANK-03** 及 ROADMAP Phase 2 成功标准。

本阶段 **不** 包含：在线命题编辑器、题目标签体系、按警种筛选/统计（见下方 D-09）、考试组卷与导出（Phase 4）。
</domain>

<decisions>
## Implementation Decisions

### 导入文件格式（用户指定模板）

- **D-01:** 唯一权威导入格式为 **Excel `.xlsx`**，列定义与 `docs/templates/题库导入模板.xlsx` 一致（用户提供的桌面模板已复制进仓库）。
- **D-02:** 数据在 **单个 sheet「题库导入」** 中混排三种题型；sheet「填写说明」仅作说明，**解析时忽略**。
- **D-03:** 表头固定为：`题干`、`题型`、`A`～`F`（可向后扩展 **`G`～`Z`**，空列忽略）、`答案`、`解析`、`知识点`、`难度`、`分值`、`警种`（见 D-09）。
- **D-04:** `题型` 必填，接受中文 **`单选` / `多选` / `判断`** 或英文 **`single` / `multi` / `judge`**。
- **D-05:** 以 **`【示例】`** 开头的题干行 **自动跳过**（与填写说明一致）；教师也可在导入前删除示例行。
- **D-06:** **判断题**：`A`=`正确`、`B`=`错误`；若 A/B 留空则 **系统自动补全** 这两列文案。
- **D-07:** **单选答案**：单个字母（如 `A`）。**多选答案**：多个字母，**顿号或逗号**分隔（如 `A、B、C`）。**判断答案**：`A`/`B` 或 `正确`/`错误`（与模板填写说明一致）。
- **D-08:** `难度` 为可选整数 **1–5**，缺省 **1**；`分值` 为可选整数，缺省 **1**；`解析`、`知识点` 选填（知识点多个时顿号/逗号分隔）。
- **D-09:** **`警种` 列本阶段忽略**——解析时 **不校验、不入库**；模板保留该列以便教师习惯，后续里程碑再支持警种维度。
- **D-10:** 管理端 **提供「下载官方模板」**，下载文件为仓库内 `docs/templates/题库导入模板.xlsx`（与导入校验使用同一文件）。

### Planner discretion（本次讨论未覆盖）

- **多选题计分规则**（QBANK-02「部分分或统一规则」）：讨论仅选定导入格式；规划阶段须 **固定一种规则** 并写入验收说明。
- **导入失败策略**（整批回滚 vs 部分成功 + 行级错误报告）：按 ROADMAP 成功标准 #2 倾向 **无脏数据**；具体事务边界由 `plan-phase` 定案。
- **预览与列表 UX**（随机抽样 vs 分页全量、预览字段）：按 ROADMAP 成功标准 #3 须能核对题干/选项/答案；展示形态由规划提议。
- **重复导入策略**（追加 / 覆盖 / 拒绝）：未讨论，规划时给出默认建议（建议：**追加**，以导入批次或时间区分，避免误覆盖）。

### Folded Todos

（无）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and requirements

- `.planning/PROJECT.md` — 产品边界、三种客观题型范围
- `.planning/REQUIREMENTS.md` — QBANK-01、QBANK-02、QBANK-03
- `.planning/ROADMAP.md` — Phase 2 目标、成功标准、计划包 02-01～02-03
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — 教师会话、管理端路由、Prisma/Compose 约定
- `.planning/phases/01-foundation-auth/01-PATTERNS.md` — Phase 1 实现模式（若存在）

### Import format (authoritative)

- `docs/templates/题库导入模板.xlsx` — **权威列定义与示例**；sheet「题库导入」为导入数据，「填写说明」为字段说明
- 用户原始参考：`c:\Users\23891\Desktop\题库导入模板.xlsx`（与仓库副本一致）

### External specs

No external ADRs — import contract is fully defined by the template file and decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/web/src/components/admin/AdminLayout.tsx` — 管理端顶栏壳层，题库页挂在此下
- `apps/web/src/pages/AdminDashboard.tsx` — 「题库」入口现为 disabled，本阶段改为可导航
- `apps/web/src/components/auth/AdminRoute.tsx` + `apps/server/src/plugins/admin-guard.ts` — 保护 `/api/admin/*`
- `apps/web/src/lib/api.ts` — `apiFetch` + `credentials: 'include'`
- `prisma/schema.prisma` — 当前仅 `Teacher`；本阶段新增题目相关模型

### Established Patterns

- Fastify 路由 `apps/server/src/routes/api/admin/*`，Zod 校验请求体
- React + shadcn（zinc）+ 中文文案（见 `01-UI-SPEC.md` 设计体系）
- PostgreSQL 事务 + Prisma migrate

### Integration Points

- 新增管理端路由如 `/admin/questions` 或 `/admin/qbank`（具体路径由规划确定）
- 文件上传：multipart 或前端读 xlsx 后 JSON 提交——由规划在性能与实现成本间取舍
- 仪表盘「题库」卡片从 disabled 变为链入导入/列表流程

</code_context>

<specifics>
## Specific Ideas

- 用户明确要求：**按 `题库导入模板.xlsx` 导入**，不接受其他列布局。
- 模板含公安/警种培训语境的示例题干（可保留为跳过示例，不影响生产数据）。

</specifics>

<deferred>
## Deferred Ideas

### 本阶段明确推迟

- **警种字段入库与按警种筛选**（模板列保留，Phase 2 不处理）— 用户选择「本阶段忽略警种列」。

### 讨论清单中未选题（留给 plan-phase）

- 多选题计分规则（灰区 2）
- 导入失败与部分成功策略（灰区 3）
- 预览与列表形态（灰区 4）
- 重复导入策略（灰区 5）
- 默认分值策略细化（灰区 6；模板已约定行级默认 1 分）

</deferred>

---

*Phase: 2-题库导入*
*Context gathered: 2026-05-15*

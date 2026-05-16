# Phase 3: 名单与学生入场 - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

教师批量导入 **姓名 + 18 位身份证号** 名单（ROST-01），管理端可检索确认；学生在独立入口输入相同两字段，系统 **逐字段完全一致** 后建立学生会话并进入 **考试准备页**（AUTH-02）。对应 ROADMAP Phase 3 成功标准。

本阶段 **不** 包含：考试组卷、拉题、作答、提交、成绩导出（Phase 4）；名单导入文件格式、失败文案与限流等 **未在本次讨论中选题** 的项，见下方 Planner discretion，由 `plan-phase` 给出默认方案并写入验收说明。
</domain>

<decisions>
## Implementation Decisions

### 身份证录入、存储与校验（已讨论）

- **D-01:** 学生端与导入名单均使用 **18 位完整身份证号**；AUTH-02 为姓名 + 身份证 **两字段同时精确匹配**（匹配前规范化见 D-03）。
- **D-02:** 名单库内身份证号 **明文存储**（机房内网封闭场景；导出/日志脱敏策略在 Phase 4 或部署文档中另行约定，本阶段不实现导出）。
- **D-03:** 比对前规范化 **仅限去除首尾空格**；**不** 自动统一 `x`/`X`、全角/半角或其他转换；导入模板与填写说明须要求教师按证件字面填写（除首尾空格外须一致）。
- **D-04:** 学生提交前与服务端均校验 **18 位身份证格式 + 校验码算法**；格式非法时 **直接拒绝，不查询名单**（减少无效查库与试探）。

### 学生会话与准备页（已讨论）

- **D-05:** 校验通过后建立学生会话，使 `studentRosterEntryId` + `studentName` 进入 **同一 `sid` Cookie 对应的 PG session 行**（与 Phase 1 教师 `teacherId` 字段并存；**不**再使用链式双 Cookie `student_sid` — 见下方修订）。
- **D-05（修订 2026-05-17）：** 曾按规划实现 `sid` + `student_sid` 双中间件，导致 session **未可靠写入 PostgreSQL**、教师管理端 **401 闪退回登录**。现改为 **单一 `sid` + 字段隔离**：教师登录时清除 `studentRosterEntryId`/`studentName`；学生 `verify` 后 **`await saveSession()`**；无教师态时 `regenerate` 学生会话。学生端与 `auth/me` 等使用前端 **`skipAuthRedirect`**，学生 401 不触发教师「登录已过期」toast/跳转。监考同浏览器试测时可在同一 `sid` 内同时保留 `teacherId` 与学生字段（`establishStudentSession` 在已有教师态时跳过 regenerate）。
- **D-06:** 准备页展示：**完整姓名 + 完整身份证号** + 固定文案 **「请等待监考教师开始考试」**（用户明确要求全号展示；机房内网可接受，须在 UI 上避免非必要二次传播）。
- **D-07:** Session 内保存 **`rosterEntryId`（名单记录主键）+ 姓名**；**不** 将身份证号写入 session；准备页所需全号由 **已认证学生 API** 按 `rosterEntryId` 从库读取后返回。
- **D-08:** 准备页提供 **「退出」**；销毁学生 session 后回到学生登录页；刷新准备页 **保持登录** 直至用户退出或 session 过期（默认 TTL 由规划与 Phase 1 session 配置对齐，建议与教师 session 同级如 8h，除非校方要求更短）。

### Planner discretion（本次未讨论 — plan-phase 定案）

- **名单导入格式与批次（原灰区 2）** — 建议沿用 Phase 2 模式：**官方 Excel `.xlsx` 模板**（`docs/templates/` 下新增名单模板，列：**姓名**、**身份证号**）；multipart 上传 + 行级校验 + 管理端「下载模板」；**导入批次**（`RosterImportBatch`）入库以便 Phase 4「考试关联名单」；重复 `(姓名, 身份证)` 策略建议 **拒绝本行并报告** 或 **全批拒绝**（避免静默覆盖，与题库 ALL_OR_NOTHING 精神一致）。具体表头、示例行跳过规则由规划写入 PLAN。
- **校验失败提示与防试探（原灰区 3）** — 建议与教师登录一致：**单一笼统文案**（不区分姓名错/证件错/不存在，满足 ROADMAP 成功标准 #3）；对 `POST` 学生校验接口施加 **rate limit**（参考题库 `IMPORT_RATE_LIMIT` 环境变量模式）；是否在 N 次失败后临时锁定 IP/会话由规划按 ASVS L1 建议取值。
- **管理端名单 UI** — ROST-01 要求检索：支持按姓名或证件号查询；列表是否默认脱敏显示证件号由规划提议（**讨论未锁**；与 D-06 学生端全号展示可并存：教师端可脱敏、学生端本人可见全号）。
- **学生路由结构** — 建议 `/` 或 `/exam/login` 为学生登录，`/exam/waiting`（或等价路径）为准备页；需 **学生路由守卫**（无 session 不可进准备页）；与 `/admin/*` 隔离。

### Folded Todos

（无）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and requirements

- `.planning/PROJECT.md` — 学员强绑定、身份证合规待决项（本阶段已部分锁定 D-01～D-04）
- `.planning/REQUIREMENTS.md` — ROST-01、AUTH-02
- `.planning/ROADMAP.md` — Phase 3 目标、成功标准（含拒绝不泄露组合信息）、计划包 03-01～03-02
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — 教师 Session、Cookie、统一登录失败文案
- `.planning/phases/02-qbank-import/02-CONTEXT.md` — Excel 导入、模板、管理端路由与 xlsx 管道模式

### Deployment

- `docs/DEPLOY.md` — 内网 HTTP 假设、session/代理相关说明

### External specs

No external ADRs — roster and student auth contract defined by planning files and decisions above. **名单 Excel 模板路径在 plan-phase 创建后追加到本列表。**

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/web/src/pages/Home.tsx` — 学生端根路径占位，本阶段替换为登录 + 准备流
- `apps/web/src/router.tsx` — 新增学生路由与守卫（勿塞入 `AdminRoute`）
- `apps/web/src/components/admin/AdminLayout.tsx` — 管理端壳层；名单页挂在其下
- `apps/web/src/pages/AdminDashboard.tsx` — 「名单」卡片本阶段改为可导航（对齐 Phase 2 题库卡片）
- `apps/web/src/components/auth/AdminRoute.tsx` + `apps/server/src/plugins/admin-guard.ts` — 仅保护 `/api/admin/*`；学生 API 需独立 `preHandler`
- `apps/server/src/routes/api/auth/login.ts` — 统一失败文案、session regenerate 先例
- `apps/server/src/routes/api/admin/questions-import.ts` — multipart xlsx、Zod/行级错误、rate limit 先例
- `apps/server/src/lib/qbank/parse-workbook.ts`、`validate-rows.ts` — 可类比实现 roster 解析校验
- `prisma/schema.prisma` — 当前无名单模型；本阶段新增 `RosterEntry`（及可选 `RosterImportBatch`）

### Established Patterns

- Fastify + `requireAdminSession` 管理端路由；学生路由使用 **独立 session 字段**（如 `studentRosterEntryId`），勿与 `teacherId` 混用同一语义
- React + shadcn（zinc）+ 中文文案（`01-UI-SPEC.md` / `02-UI-SPEC.md` 设计体系）
- PostgreSQL + Prisma migrate；敏感字段明文存储须在 SECURITY/plan 中记录威胁假设（内网、物理访问控制）

### Integration Points

- 管理端：`/admin/roster`（路径由规划确定）+ `/api/admin/roster/*`（import、list、search、template）
- 学生端：`POST /api/student/verify`（或等价）校验姓名+身份证 → 建 session → 前端进准备页
- `GET /api/student/me` — 返回准备页所需姓名、身份证号（须已登录学生 session）
- Phase 4 将消费 `rosterEntryId` 与名单批次关联考试，模型设计须预留外键或批次 ID

</code_context>

<specifics>
## Specific Ideas

- 用户明确选择：身份证 **全号明文**、比对 **仅 trim**、**强格式校验**；准备页 **完整展示姓名与身份证号**（非脱敏）。
- 学生与教师 **同 Cookie 名、不同 session 字段**（非 `student_sid` 双 Cookie）；可退出；session 不存证件号，由 API 读出展示。

</specifics>

<deferred>
## Deferred Ideas

### 讨论清单中未选题（留给 plan-phase / 后续阶段）

- **名单导入 Excel 列布局、批次与重复策略**（原灰区 2）
- **失败提示文案与 rate limit 细节**（原灰区 3）
- **管理端列表证件号脱敏展示** — 未讨论；可与 D-06 学生端全号展示分别定案
- **导出与日志中身份证脱敏** — Phase 4（EXPR）或部署合规文档

### 本阶段范围外

- 考试组卷、答题、提交、成绩导出 — Phase 4

</deferred>

---

*Phase: 3-名单与学生入场*
*Context gathered: 2026-05-16*

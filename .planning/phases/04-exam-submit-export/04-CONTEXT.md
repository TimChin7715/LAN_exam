# Phase 4: 考试、提交与导出 - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

教师为一次考试关联已导入**题目**与**参考名单**；名单内学生在监考控制的开考后可答题并提交；管理端可见提交记录；教师可导出**成绩汇总**与**题目级明细**（EXAM-01、EXAM-02、EXPR-01、EXPR-02）。对应 ROADMAP Phase 4 成功标准与计划包 04-01～04-03。

本阶段 **不** 包含：v2 防作弊（切屏、乱序、时间窗等）、断网会话恢复（UX-01）、主观题阅卷。

本次讨论 **仅** 锁定了「开考与考试状态」相关决策；组卷方式、名单绑定、作答保存、提交策略、计分展示、导出格式等见 **Planner discretion**，由 `plan-phase` 结合既有验收文档给出默认方案并写入 PLAN / ACCEPTANCE。
</domain>

<decisions>
## Implementation Decisions

### 开考与考试状态（已讨论）

- **D-01:** 考试采用 **三态**：**草稿 → 进行中 → 已结束**。进入「已结束」后 **学生不可再作答**（或不可再提交，与提交策略在 plan-phase 与 EXAM-02 对齐）；**教师仍可查看 / 导出** 等只读能力由实现与 EXPR 验收约定。
- **D-02:** 从 **草稿** 进入 **进行中** 必须由教师 **显式操作「开始考试」**（或等价文案），**不** 采用「学生首次打开试卷即自动开考」等隐式触发。
- **D-03:** 学生在 **准备页**（`/exam/waiting` 及等价路径）上，通过 **短轮询** 检测考试是否已进入「进行中」；轮询间隔建议 **约 3～5 秒**（确切值与退避策略由 plan-phase 按内网负载取值）；检测到可开考后 **自动跳转** 至答题入口/答题页（具体 URL 由规划定义）。
- **D-04:** 从 **进行中** 进入 **已结束** 必须由教师 **显式「结束考试」**（或等价文案）；**不** 将「全员提交后自动结束」作为 **唯一** 收卷方式。若日后增加「全员提交则自动结束」作为辅助，**本次未锁定**。

### Planner discretion（本次未讨论 — plan-phase 定案）

- **组卷与题目关联**（原灰区 2）：题目来源（全库 / 批次）、顺序、是否全员同卷等。
- **名单关联方式**（原灰区 3）：绑定整批导入、勾选条目、默认批次策略；非名单内已登录学生的错误处理。
- **作答保存与答题 UX**（原灰区 4）：自动保存草稿、单页/逐题、提交前是否可改答案等。
- **提交与重复提交 EXAM-02**（原灰区 5）：拒答再交 / 覆盖 / 只读查看；未提交是否计分或标未交等。
- **计分与成绩展示**（原灰区 6）：提交时算分 vs 批量算分；管理端逐题预览等。
- **导出格式与脱敏 EXPR**（原灰区 7）：CSV vs Excel 主交付、汇总/明细分文件、证号导出形态等。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and requirements

- `.planning/PROJECT.md` — 产品边界、核心价、身份证/导出合规语境
- `.planning/REQUIREMENTS.md` — EXAM-01、EXAM-02、EXPR-01、EXPR-02
- `.planning/ROADMAP.md` — Phase 4 目标、成功标准、计划 04-01～04-03
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — 教师 Session、Cookie、管理端路由
- `.planning/phases/02-qbank-import/02-CONTEXT.md` — 题库导入、模板、管理端模式
- `.planning/phases/02-qbank-import/02-ACCEPTANCE.md` — **QBANK-02**、`MultiScoringRule.ALL_OR_NOTHING` 计分契约（Phase 4 服务端阅卷 MUST 一致）
- `.planning/phases/03-roster-student-entry/03-CONTEXT.md` — 学生 `student_sid`、`studentRosterEntryId`、准备页行为
- `.planning/phases/03-roster-student-entry/03-ACCEPTANCE.md` — AUTH-02、Phase 4 消费 `studentRosterEntryId`、名单内校验说明

### Deployment

- `docs/DEPLOY.md` — 内网部署、代理与运维假设

### External specs

No external ADRs — 本阶段需求与客观题契约由上述 planning 与 `02-ACCEPTANCE.md` 等锁定。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/web/src/router.tsx` — `/exam/login`、`/exam/waiting`；可扩展 `/exam/...` 答题路由；管理端 `/admin/*` 与 `AdminLayout`
- `apps/web/src/pages/StudentWaiting.tsx` — 准备页 UI 与「请等待监考教师开始考试」；可挂载轮询与跳转
- `apps/web/src/components/auth/StudentRoute.tsx` — 学生路由守卫与登录/准备页重定向逻辑
- `apps/web/src/pages/AdminDashboard.tsx` — 「考试」卡片当前为 disabled，本阶段可链入考试管理入口
- `apps/server/src/lib/student-auth.ts`、`apps/server/src/lib/session.ts` — 学生会话读写模式
- `apps/server/src/routes/api/student/verify.ts` — 学生校验与建 session 先例
- `prisma/schema.prisma` — `Question`、`RosterEntry`、`RosterImportBatch` 等；尚无 `Exam` 实体，本阶段新增模型与关联表

### Established Patterns

- Fastify + 管理端 `requireAdminSession`；学生 API 独立鉴权（勿与 `teacherId` 混用语义）
- React + shadcn（zinc）+ 中文文案；`apiFetch` + `credentials: 'include'`

### Integration Points

- 学生：准备页轮询「考试状态」类 API（路径由规划定义）→ 跳转答题
- 教师：管理端考试 CRUD、开始/结束动作、与题目/名单的关联 UI 与 `/api/admin/...` 路由
- 阅卷/提交：须服务端校验考生属于当次考试名单且考试状态允许作答（见 `03-ACCEPTANCE.md` Phase 4 消费说明）

</code_context>

<specifics>
## Specific Ideas

- 用户明确：**三态**、教师显式 **开始** 与 **结束**、准备页 **短轮询 + 自动跳转** 进入答题。

</specifics>

<deferred>
## Deferred Ideas

### 本阶段讨论未覆盖（交由 plan-phase）

- 组卷、名单绑定、作答 UX、提交与重复提交、计分展示、导出与脱敏等（见上文 Planner discretion）。

### 本阶段范围外（产品路线图）

- v2 `SEC-*`、`UX-01` 等见 `.planning/REQUIREMENTS.md` v2 段。

</deferred>

---

*Phase: 4-考试、提交与导出*
*Context gathered: 2026-05-16*

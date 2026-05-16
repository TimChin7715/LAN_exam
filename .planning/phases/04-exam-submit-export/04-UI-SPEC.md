---
phase: 4
slug: exam-submit-export
status: draft
shadcn_initialized: true
preset: "new-york / zinc (components.json + index.css)"
created: 2026-05-16
---

# Phase 4 — UI Design Contract

> Visual and interaction contract for **考试、提交与导出**（管理端考试编排/开收卷/成绩导出；学生端轮询开考、答题、提交）。Generated for plan-phase; verify with gsd-ui-checker before execution.

**Scope:** 管理端 `/admin/exams`、`/admin/exams/:id`；仪表盘「考试」卡片启用；学生端 `/exam/waiting` 轮询（D-03）、`/exam/take` 答题与提交；`GET /api/student/exam/*` 与 `GET/POST /api/admin/exams/*`。中文界面。延续 Phase 1–3 `AdminLayout`、shadcn new-york zinc。

**Out of scope (UI):** v2 防作弊（切屏、乱序、时间窗）；断网会话恢复（UX-01）；主观题阅卷；学生端成绩排行榜。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui |
| Preset | `new-york` style, `zinc` base, `cssVariables: true` |
| Icon library | `lucide-react` |
| Font | `"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif` |
| Framework | React + Vite + Tailwind CSS v4 |

**Implementation note:** 色值与间距使用 `index.css` 语义变量；**不得** 新建第二套 token。

---

## URL & Layout Shell

| Route | Surface | Auth |
|-------|---------|------|
| `/exam/waiting` | 准备页 + **4s 轮询**开考（D-03） | 学生 session |
| `/exam/take` | 答题页（单页滚动 + 提交确认） | 学生 session + 考试 `IN_PROGRESS` |
| `/admin/exams` | 考试列表 | 教师已登录且已改密 |
| `/admin/exams/:examId` | 考试详情（配置 / 开收卷 / 成绩 / 导出） | 同上 |
| `/admin` | 仪表盘；「考试」卡片 → `/admin/exams` | 同上 |

**Admin shell:** 考试页使用 `AdminLayout`（顶栏 56px、主内容 `max-w-[960px]` 列表页；详情页可 `max-w-[1120px]`）。

**Student shell:** 答题/准备页 **不使用** `AdminLayout`；全屏居中或顶栏极简（仅显示考试标题 + 退出），背景 `bg-background`。

---

## Phase Surfaces

### S0 — 仪表盘「考试」入口

| Element | Spec |
|---------|------|
| 考试卡片 | `Link` → `/admin/exams`；`hover:border-primary/50`；副标签「进入」 |
| 说明文案 | 可选将「考试编排」从筹备中改为已开放；**默认** 更新主说明一句提及考试管理 |

### S1 — 考试列表 (`/admin/exams`)

| Element | Spec |
|---------|------|
| 页头 | Heading「考试管理」+ Body 说明「创建考试、关联题库批次与名单批次，开始考试后考生方可答题。」 |
| 返回 | 「← 返回仪表盘」→ `/admin` |
| 主 CTA | Primary「新建考试」→ 打开 `Dialog` 或导航至创建流（实现择一；**契约**：单页 Dialog 优先 MVP） |
| 表格列 | **考试名称**｜**状态**（Badge）｜**题目批次**（文件名或 truncated id）｜**名单批次**｜**提交人数/名单人数**｜**操作** |
| 状态 Badge | `DRAFT` → secondary「草稿」；`IN_PROGRESS` → default/primary「进行中」；`ENDED` → outline「已结束」 |
| 行操作 | 「查看」→ `/admin/exams/:id`；草稿可「删除」（destructive 二次确认） |
| 空状态 | 「暂无考试」+ Primary「新建考试」 |

### S2 — 新建/编辑考试 Dialog（`DRAFT` only）

| Element | Spec |
|---------|------|
| 字段 | `考试名称`（必填）；`题目批次`（`Select`，选项来自 `GET /api/admin/questions/batches` 或等价）；`名单批次`（`Select`，来自 roster batches） |
| 说明 | Muted：「将关联所选批次中的全部题目与全部名单考生。开始考试后不可更换批次。」 |
| 提交 | Primary「保存」；成功 Toast + 跳转详情页或刷新列表 |
| 校验 | 未选批次 disabled；名称 trim 非空 |

### S3 — 考试详情 (`/admin/exams/:examId`)

**信息架构（自上而下）：**

1. 页头：标题 + 状态 Badge + 返回列表
2. **监考操作区**（Card）：开始考试 / 结束考试（见 S4）
3. **配置摘要**（Card）：关联批次、题目数、名单人数、开始/结束时间
4. **成绩与提交**（Card）：提交列表表格 + 导出按钮（S5）
5. **题目预览**（可折叠 Card）：只读题目列表（无答案列给教师？**管理端可显示正确答案** 便于监考核对 — 与 RESEARCH 一致）

| Element | Spec |
|---------|------|
| 草稿态 | 显示「编辑」入口（改标题/批次，若改批次需确认重建题目） |
| 进行中 | 隐藏编辑批次；显示「结束考试」 |
| 已结束 | 全部监考按钮 disabled；导出与查看可用 |

### S4 — 监考操作（D-02 / D-04）

| Element | Spec |
|---------|------|
| 开始考试 | `DRAFT` 时 Primary「开始考试」；`AlertDialog` 确认：「确认开始考试？开始后考生将进入答题，且不可再修改题目与批次。」 |
| 结束考试 | `IN_PROGRESS` 时 `variant="destructive"` 或 outline destructive「结束考试」；确认：「确认结束考试？结束后考生将无法继续作答或提交。」 |
| 非法态 | 非对应状态按钮 **不渲染**（非 disabled 误导） |
| 成功 | Toast「考试已开始」/「考试已结束」；刷新详情与 Badge |
| 失败 | Toast error + API 消息（如「同一名单批次已有进行中的考试」） |

### S5 — 成绩列表与导出（EXPR）

| Element | Spec |
|---------|------|
| 表格列 | **姓名**｜**身份证号**（脱敏：前6+********+后4）｜**总分**｜**是否提交**｜**提交时间** |
| 未提交 | 「是否提交」列显示 Badge outline「未提交」；总分列「—」 |
| 已提交 | Badge「已提交」；总分数字；提交时间 `yyyy-MM-dd HH:mm` |
| 导出 | Primary outline「导出成绩与明细」；`GET /api/admin/exams/:id/export` → 下载 `{考试名称}-成绩与明细.xlsx` |
| 导出禁用 | `DRAFT` 且无提交时可 disabled + Tooltip「请先开始考试并有考生提交」；`ENDED` 后始终可导出（含 0 提交） |

### S6 — 准备页轮询增强 (`/exam/waiting`) — D-03

| Element | Spec |
|---------|------|
| 保留 | Phase 3 身份区 +「请等待监考教师开始考试」 |
| 轮询 | `setInterval` **4000ms**；`document.hidden` 时 **clearInterval** |
| 开考跳转 | `status === 'IN_PROGRESS'` → `navigate('/exam/take?examId=...', { replace: true })` |
| 辅助说明 | Muted：「监考教师开始考试后，本页将自动进入答题界面。」 |
| 轮询中 | 等待文案下方可选小字 Spinner +「正在等待开考…」（muted，不抢眼） |
| 无考试 | `status === 'none'` 保持等待文案（不报错） |

### S7 — 答题页 (`/exam/take`)

| Element | Spec |
|---------|------|
| 顶栏 | 固定或 sticky：考试标题（Heading 20px）+ 右侧 outline「退出」（回 waiting 或 logout — **契约：退出到 waiting 且保留 session**） |
| 题目区 | **单页滚动**；每题 `Card` 或 bordered section：`题号` + Badge 题型 + 题干 + 选项 |
| 单选/判断 | `RadioGroup` 每项一行，点击区域 ≥ 44px |
| 多选 | `Checkbox` 组；题干下 muted 一行：「多选题：全部选对才得分，少选或错选不得分。」 |
| 自动保存 | 选项变更后 debounce **2s** 调用 `PUT .../answers`；保存成功 subtle「已保存」muted 2s 消失；失败 Toast |
| 底部栏 | sticky footer：`已答 x / 共 y` + Primary「提交试卷」 |
| 提交确认 | `AlertDialog`：「提交后无法修改答案，是否确认提交？」；确认后 loading「正在提交…」 |
| 提交成功 | 跳转 **提交结果页** 或同页只读态：显示总分 +「已提交」+ 按钮「退出」→ logout 或 waiting |
| 重复提交 | 进入页时若已提交 → 只读回放模式（选项 disabled）+ Banner「您已提交本场考试」 |
| 考试结束 | API 409 → Alert「考试已结束，无法继续作答。」+ 引导退出 |
| 加载 | 全页 Spinner「加载试卷…」 |

### S8 — 学生路由扩展

| Route | Guard |
|-------|-------|
| `/exam/take` | 需学生 session；无 `IN_PROGRESS` 考试 → 重定向 `/exam/waiting` |
| `/exam/waiting` | 已有 session 且检测到 `IN_PROGRESS` 时访问 waiting → 可重定向 take（与轮询一致） |

---

## Spacing & Typography

继承 Phase 3 `03-UI-SPEC.md`；本阶段无新增 token。

| Role | Phase 4 usage |
|------|----------------|
| Display 28px | 学生登录/准备（沿用）；答题页顶栏用 Heading 20px |
| Heading 20px | 考试管理页标题、题号 |
| Body 16px | 题干、选项、等待说明 |
| Label 14px semibold | 表单标签、表头 |

---

## Component Inventory

**新增 shadcn（若未安装）：** `radio-group`, `checkbox`, `alert-dialog`, `badge`（已有）, `tooltip`（导出禁用提示）

**Patterns:**

- 批次选择：`Select` 与 Phase 2 筛选器一致
- 提交确认：`AlertDialog` 与删除确认同模式
- 导出下载：`<a download>` 或 `window.open` 带 cookie 的 `fetch` + blob（对齐模板下载）

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| 新建考试 | 新建考试 |
| 开始考试 | 开始考试 |
| 结束考试 | 结束考试 |
| 提交试卷 | 提交试卷 |
| 提交确认 | 提交后无法修改答案，是否确认提交？ |
| 已提交 Banner | 您已提交本场考试，以下为您的作答记录。 |
| 重复提交 API | 您已提交过本场考试，无法再次提交。 |
| 考试已结束 | 考试已结束，无法继续作答。 |
| 无法参加 | 当前无法参加本场考试。 |
| 自动保存 | 已保存 |
| 导出文件名 | `{考试名称}-成绩与明细.xlsx` |
| 多选说明 | 多选题：全部选对才得分，少选或错选不得分。 |

---

## Accessibility

- 选项组：`fieldset` + `legend`（题号+题型）
- 提交按钮：提交中 `aria-busy`
- Badge 状态：不仅靠颜色区分（含文字）
- 键盘：Radio/Checkbox 可键盘切换；提交 Dialog 焦点陷阱

---

## API ↔ UI Mapping

| UI action | API |
|-----------|-----|
| 轮询开考 | `GET /api/student/exam/status` |
| 加载试卷 | `GET /api/student/exam/paper?examId=` |
| 自动保存 | `PUT /api/student/exam/answers` |
| 提交 | `POST /api/student/exam/submit` |
| 考试列表 | `GET /api/admin/exams` |
| 开始/结束 | `POST .../start` / `POST .../end` |
| 导出 | `GET /api/admin/exams/:id/export` |

---

*Phase: 4-exam-submit-export · UI contract for plan-phase 2026-05-16*

# LAN Exam — 项目上下文（Agent / 维护者）

> 本文档面向维护者与 AI 协作者，描述当前工作区的产品约束、运行模型与代码落点。部署方案全量背景见 [docs/PLAN-考官免登录一键部署.md](./docs/PLAN-考官免登录一键部署.md)。

## 产品定位

机房 / 教室 **局域网考试系统**（pnpm monorepo）：管理机兼服务器，学员机仅访问考试端。

| 角色 | URL | 认证 |
| --- | --- | --- |
| 考官（管理台） | `http://127.0.0.1:5180/admin` | 默认免登录；仅本机 hostname + API loopback |
| 学员 | `http://<管理机LAN_IP>:5180/exam/*` | 名单校验：姓名 + 身份证号 |

**考场交付（推荐）**：离线 `LAN-Exam-Setup.exe`（Inno Setup）+ 托盘 + 便携 Postgres / Node，详见 [docs/DEPLOY-WINDOWS-NATIVE.md](./docs/DEPLOY-WINDOWS-NATIVE.md)。

## 术语约定

- 统一使用：**考官 / 学员 / 管理机 / 身份证号**。
- 历史文档里出现的“教官端”“准考证验证”等表述按旧方案理解，当前实现以本文件为准。

## 已确认决策（勿擅自推翻）

| # | 议题 | 结论 |
| --- | --- | --- |
| 1 | 交付 | 必须提供 `LAN-Exam-Setup.exe` + 桌面快捷方式；管理台仅安装机 loopback |
| 2 | 历史数据 | 不迁移；免登录绑定 `local_exam_admin`，旧 `teacher_admin` 数据不可见，须重新导入 |
| 3 | 托盘 | 关窗最小化到托盘；仅托盘“退出系统”停止 Postgres + Node |
| 4 | 防火墙 | 安装时入站放行 **TCP 5180**（专用网）；**5434 仅本机** |
| 5 | 离线 | 考场禁止外网；所有二进制在有网构建机打入 Setup |
| 6 | 默认认证 | 代码与 `.env.example` 默认 `ADMIN_AUTH_MODE=disabled` |

Phase A / B 已落地；真机双机验收仍需在目标环境执行。

## 当前能力面

### 管理台

- 题库管理支持三类内容：
  - 客观题：Excel 导入，支持单选 / 多选 / 判断。
  - 填空题：Word 题目 + Excel 答题卡 + 可选附件；答题卡工作表名为 `答题卡`，列为“题号 / 答案 / 分值”。
  - 操作题：Word 试卷 + Excel / CSV 附件；不自动计分。
- 名单导入字段固定为“姓名 / 单位 / 身份证号”。
- 考试可组合 `OBJECTIVE` / `FILL` / `PRACTICAL` 三种内容模块。
- 设置页支持：
  - `showSeatBoard`：控制学员登录页与考试详情是否显示座位表。
  - “清除全部数据”：删除当前考官账号下的考试、题库、名单、填空题 / 操作题批次与相关上传文件；设置本身保留。
- 考试详情支持：
  - 开始 / 结束考试
  - 查看随机分配后的座位表
  - 导出成绩（成绩汇总 + 客观题答题明细 + 填空题明细）
  - 导出填空题截图（已交卷学员 ZIP，按答题卡题号命名：第 x 题 / 第 x 题1…）
  - 下载学员操作题答卷

### 学员端

- 登录使用姓名 + 身份证号；`student-guard` 维护独立学员 session。
- 当前流程页为：
  - `/exam/login`
  - `/exam/waiting`
  - `/exam/take`
  - `/exam/submitted`
  - `/exam/ended`
- 客观题与填空题作答会自动保存；填空题每空可上传或粘贴截图（佐证，不参与自动评分）；操作题需上传 `.doc` / `.docx` 作答文件后才能交卷。
- 考试结束后：
  - 已交卷学员进入 submitted / ended 只读视图
  - 未交卷学员进入 ended 提示页，不再允许继续作答

### 座位表与评分

- 座位在考试维度按 `random_shuffle_v1` 自动随机分配，首次加载座位表时若无分配记录会自动生成。
- 客观题与填空题可自动评分；混合考试总分仅累计自动评分部分。
- 操作题答卷仅存档与下载，不参与自动总分计算。

## 运行时与端口

| 环境 | 进程 | 端口 |
| --- | --- | --- |
| 开发 `pnpm dev` | API + Vite | API **3101**，Web **5180**（Vite 代理 `/api`） |
| 生产 / Docker / Windows | 单 Node（`NODE_ENV=production` 或 `SERVE_WEB=true`） | **5180**（API + `apps/web/dist` SPA） |
| Postgres | 便携或 Docker | **5434** 仅 `127.0.0.1` |

生产路由：`/health`、`/api/*`、其余 → SPA + `index.html` fallback。

## 考官认证（双模式）

### 环境变量（前后端须成对）

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `ADMIN_AUTH_MODE` | `disabled` | `disabled` = 免登录；`session` = 账号登录回退 |
| `LOCAL_ADMIN_USERNAME` | `local_exam_admin` | disabled 下写入数据的固定 `teacherId` |
| `ADMIN_API_LOOPBACK_ONLY` | `true` | 机房包不应关闭 |
| `VITE_ADMIN_AUTH_MODE` | 与后端一致 | `disabled` 时前端跳过登录路由 |

未设置时 `admin-context.ts`、`seed.ts`、`docker-entrypoint.sh` 均默认 disabled。开发须同时设置 `ADMIN_AUTH_MODE` 与 `VITE_ADMIN_AUTH_MODE`。

### 后端分层

1. `apps/server/src/plugins/admin-loopback-guard.ts`
   - `/api/admin/*` 始终仅 loopback
   - `disabled` 时 `/api/auth/*` 亦仅 loopback
2. `apps/server/src/plugins/admin-guard.ts`
   - `disabled` 时 `requireAdminSession` 直接通过
   - `session` 时校验 cookie + 改密状态
3. `apps/server/src/lib/admin-context.ts`
   - `resolveAdminTeacherId()`：disabled → `local_exam_admin`；session → 当前 session `teacherId`
4. `prisma/seed.ts`
   - disabled → `local_exam_admin`（随机不可用 hash）
   - session → `teacher_admin` + `SEED_ADMIN_PASSWORD`

**不要删除** `Teacher`、`AdminLogin`、`AdminLogin.tsx` 等 session 回退相关代码。

### 前端行为

- `apps/web/src/lib/admin-auth.ts`
  - `isAdminAuthDisabled()`
  - `isLocalAdminHost()`
- `apps/web/src/components/auth/AdminRoute.tsx`
  - 非 `localhost` / `127.0.0.1` / `[::1]` 显示“请在本机打开”
- `apps/web/src/router.tsx`
  - disabled 时不注册 `/admin/login`、`/admin/change-password`
- `apps/web/src/contexts/AuthContext.tsx`
  - disabled 时固定已登录，不调 `/api/auth/me`

## 数据与存储

- 免登录默认数据归属：`local_exam_admin`
- 旧 `teacher_admin` 数据不迁移、不自动映射
- 考官导入模板：仓库根 `templates/`（`lib/templates-dir.ts` → `getRepoRoot()/templates`；Docker / Windows 离线包须打包此目录）
- 开发与 CI 测试样例：`fixtures/import-test/`、`fixtures/export/`（不参与运行时）
- 上传与衍生文件位于 `DATA_DIR`（默认 `data/`）
- 当前重要存储前缀：
  - `fill-in-batches/{batchId}`
  - `practical-batches/{batchId}`
  - `exam-work/{examId}`（含操作题答卷与填空题截图 `.../{rosterEntryId}/fill-in/{examQuestionId}/{screenshotId}.{png|jpg|webp}`）
- 填空题截图：考中 `FillInScreenshotDraft`，交卷时 `lib/fillin/finalize-screenshots.ts` 固化到 `FillInScreenshot`（绑定 `Submission`）

## 关键代码落点

### 服务端

```
apps/server/src/
  lib/admin-context.ts
  lib/admin-settings.ts
  lib/env.ts
  lib/exam/
  lib/fillin/
  lib/practical/
  lib/roster/
  lib/seat/
  lib/storage/
  plugins/admin-guard.ts
  plugins/admin-loopback-guard.ts
  plugins/student-guard.ts
  routes/api/admin/*
  routes/api/student/*
  index.ts
```

重点约束：

- 改 admin 路由时使用 `await resolveAdminTeacherId(request)`，不要直接依赖 `getSessionTeacherId`。
- 成绩导出：`lib/exam/export-workbook.ts`（成绩汇总 + 客观题明细 + 填空题明细）。
- 导入模板下载：`lib/templates-dir.ts`；`routes/api/admin/*-template.ts` 从 `templates/` 读取。
- 填空题截图：`lib/fillin/finalize-screenshots.ts`、`build-screenshots-zip.ts`、`screenshot-export-name.ts`；上传校验 `lib/upload/image-file.ts`（`MAX_FILLIN_SCREENSHOT_BYTES`，每空最多 5 张）；学员 API `routes/api/student/exam-fillin-screenshots.ts`；考官导出 `routes/api/admin/exams-export-fillin-screenshots.ts`。
- 清除全部数据：`lib/admin/clear-teacher-data.ts` + `routes/api/admin/settings.ts`。
- 学员状态流转重点看：
  - `routes/api/student/exam-status.ts`
  - `lib/exam/student-ended-summary.ts`
  - `lib/exam/submit.ts`
  - `lib/exam/submit-practical.ts`（操作题交卷前置）

### 前端

```
apps/web/src/
  contexts/AuthContext.tsx
  components/auth/AdminRoute.tsx
  components/exam/ExamSeatBoard*.tsx
  components/student/*
  lib/admin-settings.ts
  lib/fillin.ts
  lib/practical.ts
  lib/roster.ts
  lib/student.ts
  pages/Admin*.tsx
  pages/Student*.tsx
  router.tsx
```

重点页面：

- `AdminQuestions.tsx`：客观题 / 填空题 / 操作题三标签
- `AdminExams.tsx`：混合考试创建
- `AdminExamDetail.tsx`：座位表、导出成绩、导出填空题截图 ZIP、下载操作题答卷
- `FillInScreenshotAttach.tsx` / `StudentFillInWorkspace.tsx`：学员填空题截图上传与粘贴
- `AdminSettings.tsx`：座位表开关、清除全部数据
- `StudentExamTake.tsx` / `StudentExamSubmitted.tsx` / `StudentExamEnded.tsx`

### 发版与安装

```
templates/              # 业务导入模板（打包进 Docker / dist/lan-exam-win/templates）
fixtures/               # 测试样例，不打包
scripts/windows/        # 发版脚本；scripts/windows/templates/ 仅为 install.bat 等
inno-setup/LAN-Exam.iss
tools/lan-exam-tray/
Dockerfile
docker-compose.yml
prisma/seed.ts
```

## 部署文档

| 文档 | 用途 |
| --- | --- |
| [docs/DEPLOY-WINDOWS-NATIVE.md](./docs/DEPLOY-WINDOWS-NATIVE.md) | 考场 U 盘安装、考前 / 考后操作、故障排查 |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Docker Compose / 反向代理（可选） |
| [docs/PLAN-考官免登录一键部署.md](./docs/PLAN-考官免登录一键部署.md) | 方案背景、验收标准、风险、Phase C |

发版（有网）：`.\scripts\windows\package.ps1` → `dist\LAN-Exam-Setup.exe`。

## 安全假设（改代码时遵守）

- 免登录依赖：**管理 API + disabled 下 auth API 仅 loopback** + 前端 hostname 检查 + 防火墙仅放行学员 5180 流量。
- 考试机访问 `http://<IP>:5180/admin`：仅提示页；`/api/admin/*` 返回 **403**。
- HTTP 仅限机房内网；不要设计公网暴露或现场下载依赖。
- 无人看管管理机等同开放管理权限。

## 开发约定

- 日常：`pnpm db:up` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`
- 默认 `.env` 采用 disabled 双变量：
  - `ADMIN_AUTH_MODE=disabled`
  - `VITE_ADMIN_AUTH_MODE=disabled`
- 学员端业务与 `ADMIN_AUTH_MODE` 无关，不要把考官逻辑混入学员流程。
- 不提交 `apps/server/dist`、`apps/web/dist`、`runtime/node|postgres` 等构建产物。

## 明确不纳入本期

SQLite 迁移、多考官 RBAC、HTTPS、云端更新、考后自动备份（Phase C 可选）。

## 当前对齐状态（2026-05）

- 默认 `ADMIN_AUTH_MODE=disabled` 与 `.env.example`、种子、entrypoint 对齐。
- `VITE_ADMIN_AUTH_MODE` 已在 `.env.example` 中启用；前后端必须成对设置。
- 文档应以当前代码面为准：三类题型、座位表、设置页、清除全部数据、学员 submitted / ended 流程、填空题截图上传与考后 ZIP 导出均已存在。

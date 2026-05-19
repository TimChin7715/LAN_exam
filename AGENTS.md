# LAN Exam — 项目上下文（Agent / 维护者）

> 本文档由 [docs/PLAN-考官免登录一键部署.md](./docs/PLAN-考官免登录一键部署.md) 合并提炼，供 AI 与协作者快速对齐产品约束与代码落点。完整方案、验收表与风险见该文件。

## 产品定位

机房/教室 **局域网考试系统**（pnpm monorepo）：管理机兼服务器，考试机仅访问学员端。

| 角色 | URL | 认证 |
| --- | --- | --- |
| 考官（管理台） | `http://127.0.0.1:5180/admin` | 默认 **免登录**（仅本机 hostname + API loopback） |
| 学员 | `http://<管理机LAN_IP>:5180/exam/*` | 名单/准考证验证（`student-guard`） |

**考场交付（推荐）**：离线 `LAN-Exam-Setup.exe`（Inno Setup）+ 托盘 + 便携 Postgres/Node，详见 [docs/DEPLOY-WINDOWS-NATIVE.md](./docs/DEPLOY-WINDOWS-NATIVE.md)。

## 已确认决策（勿擅自推翻）

| # | 议题 | 结论 |
| --- | --- | --- |
| 1 | 交付 | 必须提供 `LAN-Exam-Setup.exe` + 桌面快捷方式；教官端 **仅安装机 loopback** |
| 2 | 历史数据 | **不迁移**；免登录绑定 `local_exam_admin`，旧 `teacher_admin` 数据不可见，须重新导入 |
| 3 | 托盘 | 关窗 → 最小化托盘，服务不停；仅托盘「退出」停 Postgres + Node |
| 4 | 防火墙 | 安装时入站放行 **TCP 5180**（专用网）；**5434 仅本机** |
| 5 | 离线 | 考场 **禁止外网**；所有二进制在有网构建机打入 Setup |
| 6 | 默认认证 | 代码与 `.env.example` 默认 `ADMIN_AUTH_MODE=disabled` |

Phase A/B 实施清单在 PLAN 中已勾选完成；真机双机验收仍须在目标环境执行。

## 运行时与端口

| 环境 | 进程 | 端口 |
| --- | --- | --- |
| 开发 `pnpm dev` | API + Vite | API **3101**，Web **5180**（Vite 代理 `/api`） |
| 生产 / Docker / Windows | 单 Node（`NODE_ENV=production` 或 `SERVE_WEB=true`） | **5180**（API + `apps/web/dist` SPA） |
| Postgres | 便携或 Docker | **5434** 仅 `127.0.0.1` |

生产路由：`/health`、`/api/*`、其余 → SPA + `index.html` fallback（`apps/server/src/lib/web-static.ts`）。

## 考官认证（双模式）

### 环境变量（须前后端成对）

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `ADMIN_AUTH_MODE` | `disabled` | `disabled` = 免登录；`session` = 账号登录回退 |
| `LOCAL_ADMIN_USERNAME` | `local_exam_admin` | disabled 下写入数据的固定 `teacherId` |
| `ADMIN_API_LOOPBACK_ONLY` | `true` | 机房包不应关闭 |
| `VITE_ADMIN_AUTH_MODE` | 构建/`.env` 与后端一致 | `disabled` 时前端跳过登录路由 |

未设置时 `admin-context.ts`、`seed.ts`、`docker-entrypoint.sh` 均默认 **disabled**。开发须同时设置 `ADMIN_AUTH_MODE` 与 `VITE_ADMIN_AUTH_MODE`（见 `.env.example`）。

### 后端分层

1. **`admin-loopback-guard.ts`**：`/api/admin/*` 始终仅 loopback；`disabled` 时 `/api/auth/*` 亦仅 loopback。
2. **`admin-guard.ts`**：disabled 时 `requireAdminSession` 直接通过；session 时校验 cookie + 改密。
3. **`admin-context.ts`**：`resolveAdminTeacherId()` — disabled → `local_exam_admin` ID；session → session `teacherId`。
4. **种子 `prisma/seed.ts`**：disabled → `local_exam_admin`（随机不可用 hash）；session → `teacher_admin` + `SEED_ADMIN_PASSWORD`。

**不删除** `Teacher` 表与 `AdminLogin` 等代码，便于 `session` 回退。

### 前端

- `apps/web/src/lib/admin-auth.ts` — `isAdminAuthDisabled`、`isLocalAdminHost()`
- `AdminRoute.tsx` — 非 `localhost`/`127.0.0.1`/`[::1]` 显示「请在本机打开」
- `router.tsx` — disabled 时不注册 `/admin/login`、`/admin/change-password`
- `AuthContext.tsx` — disabled 时固定已登录，不调 `/api/auth/me`

## 关键路径索引

```
apps/server/src/
  lib/admin-context.ts      # 认证模式与 local admin ID
  lib/env.ts                # 端口、shouldServeWeb
  plugins/admin-guard.ts
  plugins/admin-loopback-guard.ts
  plugins/student-guard.ts
  routes/api/admin/*        # 均使用 resolveAdminTeacherId
  routes/api/student/*
  index.ts                  # 注册插件与静态托管

apps/web/src/
  contexts/AuthContext.tsx
  components/auth/AdminRoute.tsx
  router.tsx

scripts/windows/            # 发版：build-release.ps1, package.ps1, fetch-runtimes.ps1
inno-setup/LAN-Exam.iss
prisma/seed.ts
docker-compose.yml          # 可选全栈，5180，默认 disabled
Dockerfile
```

## 部署文档

| 文档 | 用途 |
| --- | --- |
| [docs/DEPLOY-WINDOWS-NATIVE.md](./docs/DEPLOY-WINDOWS-NATIVE.md) | 考场 U 盘安装、考前清单、故障排查 |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Docker Compose / 反向代理（可选） |
| [docs/PLAN-考官免登录一键部署.md](./docs/PLAN-考官免登录一键部署.md) | 完整方案、验收标准、风险、Phase C |

发版（有网）：`.\scripts\windows\package.ps1` → `dist\LAN-Exam-Setup.exe`。

## 安全假设（改代码时遵守）

- 免登录依赖：**管理 API +（disabled 下）auth API 仅 loopback** + 前端 hostname 检查 + 防火墙只放行学员 5180 流量。
- 考试机访问 `http://<IP>:5180/admin`：仅提示页；`curl .../api/admin/ping` → **403**。
- HTTP 限机房内网；勿设计公网暴露或考场内外网下载。
- 物理安全：无人看管管理机 = 开放管理权限。

## 开发约定

- 日常：`pnpm db:up` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`（`.env` 双变量 disabled）。
- 改 admin 路由：使用 `await resolveAdminTeacherId(request)`，勿直接用 `getSessionTeacherId`。
- 学员端业务（`StudentExamTake` 等）与 `ADMIN_AUTH_MODE` 无关，勿误加考官逻辑。
- 不提交 `apps/server/dist`、`runtime/node|postgres` 等构建产物。

## 明确不纳入本期

SQLite 迁移、多考官 RBAC、HTTPS、云端更新、考后自动备份（Phase C 可选）。

## 冲突修复记录（2026-05）

- 默认 `ADMIN_AUTH_MODE=disabled` 与 `.env.example`、种子、entrypoint 对齐。
- `VITE_ADMIN_AUTH_MODE` 在 `.env.example` 中启用；README 强调成对设置。
- `docs/DEPLOY.md` 与 5180 单进程、disabled 种子一致；Dockerfile 修复生产 `pnpm install` / entrypoint CRLF。

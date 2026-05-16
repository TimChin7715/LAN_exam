---
phase: 01-foundation-auth
verified: 2026-05-15T12:00:00Z
status: gaps_found
score: 13/14
overrides_applied: 0
gaps:
  - truth: "在目标部署方式下启动服务后，从局域网内另一台机器浏览器打开首页或登录页无连接错误"
    status: failed
    reason: "Docker Compose `app` 服务仅运行 Fastify API（:3001），未挂载或托管 `apps/web` 构建产物；`GET /` 与 `/admin/login` 在 compose 默认路径下不可达。路径 B 文档将静态站点交给外部 Nginx/IIS，但 compose 一键路径与 README「浏览器访问 Web」表述不一致。"
    artifacts:
      - path: "Dockerfile"
        issue: "build 阶段构建了 web，但 production 阶段仅 COPY server/dist，未包含 apps/web/dist"
      - path: "apps/server/src/index.ts"
        issue: "仅注册 /health 与 /api/*，无 @fastify/static 或 SPA fallback"
      - path: "docker-compose.yml"
        issue: "仅映射 3001（API），无 web 服务或静态资源卷"
      - path: "README.md"
        issue: "「浏览器访问 Web：见 compose 中 app 服务暴露的端口」与仅 API 端口不符"
    missing:
      - "在 production 镜像或 compose 中提供 SPA（例如 @fastify/static 托管 apps/web/dist，或增加 web 服务并文档化端口）"
      - "更新 README/DEPLOY 使 Docker 首选路径与「首页/登录页可访问」验收一致"
human_verification:
  - test: "在机房服务器执行 `SEED_ADMIN_PASSWORD=... docker compose up --build`，从局域网另一台 PC 浏览器访问 `http://<服务器IP>:3001/` 与 `/admin/login`"
    expected: "首页或登录页正常渲染（非 404/连接拒绝）；若仅 /health 可用则与当前实现一致，需确认是否接受"
    why_human: "本机未运行 Docker 栈；需真实双机网络与浏览器验证"
  - test: "pnpm dev（server+web）或 path B 静态部署后，用种子账号 `teacher_admin` 完成登录 → 改密 → 仪表盘"
    expected: "正确凭据进入仪表盘；错误凭据显示统一错误文案；未登录访问 /admin 重定向登录"
    why_human: "会话 Cookie 与 SPA 路由守卫需浏览器端到端确认"
  - test: "curl 认证 API：`POST /api/auth/login` → `GET /api/auth/me` → `POST /api/auth/change-password` → `GET /api/admin/ping`"
    expected: "Set-Cookie sid；me 401/200；改密后 admin/ping 200"
    why_human: "需运行中的 Postgres 与种子数据"
---

# Phase 1: 基础服务与教师认证 Verification Report

**Phase Goal:** 专用服务器上运行 Web 应用，局域网内可访问；教师可登录管理端，未授权不可访问管理功能。  
**Verified:** 2026-05-15T12:00:00Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

## MVP Mode Note

ROADMAP 标注 **Mode: mvp**，但阶段目标不是 User Story 句式（`As a …, I want …, so that …`）。本次按 ROADMAP **Success Criteria** 与三份 PLAN `must_haves` 做 goal-backward 技术验证，未生成低质量 User Flow 表。建议在 `/gsd mvp-phase 1` 将目标改写为用户故事，或保持标准模式。

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 局域网另一台机器浏览器打开首页或登录页无连接错误（ROADMAP SC1 / INFRA-01） | ✗ FAILED | `Dockerfile` production 阶段无 `apps/web/dist`；`index.ts` 无 `/` 或静态路由；compose 仅 :3001 API |
| 2 | 教师正确凭据可进入管理端仪表盘占位页（ROADMAP SC2 / AUTH-01） | ✓ VERIFIED | `AdminLogin.tsx` → `authApi.login`；`AdminRoute` 改密/仪表盘路由；`AdminDashboard.tsx` 占位 |
| 3 | 错误凭据或未登录态无法访问受保护 API/页面（ROADMAP SC3 / AUTH-01） | ✓ VERIFIED | `login.ts` 统一 401 + `INVALID_CREDENTIALS`；`admin-guard.ts`；`AdminRoute` 重定向 |
| 4 | `docker compose up --build` 可启动 app+db 或 app 单独提供 `GET /health` 200 | ✓ VERIFIED | `docker-compose.yml` db healthcheck + app；`index.ts` `/health` + DB ping；`docker compose config` 通过 |
| 5 | `GET /health` 返回 `{"status":"ok"}` | ✓ VERIFIED | `apps/server/src/index.ts:22-24` |
| 6 | `docs/DEPLOY.md` 含路径 A（0.0.0.0+防火墙）与路径 B（loopback+反代） | ✓ VERIFIED | `docs/DEPLOY.md` §路径 A / §路径 B |
| 7 | 根 `README.md` 含 `## 本地开发（Docker 优先）` 与一键命令 | ✓ VERIFIED | `README.md:12-17` |
| 8 | `prisma migrate deploy` 可应用于空库 | ✓ VERIFIED | `prisma/migrations/.../migration.sql` CREATE TABLE Teacher；`scripts/docker-entrypoint.sh:10` |
| 9 | seed 插入 `mustChangePassword=true` 的 argon2 哈希 Teacher | ✓ VERIFIED | `prisma/seed.ts` argon2 + `teacher_admin` |
| 10 | 应用启动执行 DB ping（SELECT 1） | ✓ VERIFIED | `index.ts:31-32` 启动前；`/health` 内再次 ping |
| 11 | `DATABASE_URL` 在 `.env.example` 与 compose `app` 环境一致（db 主机名） | ✓ VERIFIED | compose `postgresql://...@db:5432`；`.env.example` 注释说明 localhost vs `db` |
| 12 | `POST /api/auth/login` 设置 HttpOnly cookie 且 JSON 含 mustChangePassword、displayName | ✓ VERIFIED | `session.ts` cookie `httpOnly`/`sid`；`login.ts:93-97` |
| 13 | `GET /api/auth/me` 无 cookie 401、有效 session 200 | ✓ VERIFIED | `me.ts:6-12` |
| 14 | `POST /api/auth/change-password` 清除 mustChangePassword 后 `/api/admin/*` 可达 | ✓ VERIFIED | `change-password.ts:57-62`；`admin-guard.ts:20-25` |
| 15 | `GET /api/admin/ping` 未认证 401 | ✓ VERIFIED | `admin-guard.ts` + `ping.ts` |
| 16 | SPA 路由与 UI-SPEC 文案（S1–S4） | ✓ VERIFIED | 精确字符串见 `Home.tsx`、`AuthChecking.tsx`、`AdminLogin.tsx`；无「忘记密码」入口 |
| 17 | 前端 API `fetch` 使用 `credentials: 'include'` | ✓ VERIFIED | `apps/web/src/lib/api.ts:37` |

**Score:** 13/14 truths verified（计 ROADMAP SC1 为 1 条失败；其余 PLAN 合并项已去重计入上表）

### Deferred Items

无。后续 Phase 2–4 不覆盖「Compose 一键提供 SPA」缺口。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | monorepo | ✓ VERIFIED | 列出 `apps/*` |
| `apps/server/src/index.ts` | Fastify + /health | ✓ VERIFIED | 含 DB ping |
| `apps/web/vite.config.ts` | Vite + /api 代理 | ✓ VERIFIED | proxy → :3001 |
| `docker-compose.yml` | postgres:16 + app | ✓ VERIFIED | 健康检查、entrypoint 环境变量 |
| `docs/DEPLOY.md` | 双路径部署 | ✓ VERIFIED | 路径 A/B、迁移/种子说明 |
| `README.md` | Docker 优先 | ⚠️ WARNING | 章节存在；Web 浏览器说明与 compose 实际端口能力不符 |
| `prisma/schema.prisma` | Teacher 模型 | ✓ VERIFIED | username unique、mustChangePassword |
| `prisma/migrations` | CREATE TABLE | ✓ VERIFIED | `init_teacher` 迁移 |
| `prisma/seed.ts` | argon2 seed | ✓ VERIFIED | `SEED_ADMIN_PASSWORD` 必填 |
| `.env.example` | DATABASE_URL + SEED | ✓ VERIFIED | |
| `apps/server/src/routes/api/auth/login.ts` | 登录 | ✓ VERIFIED | rate-limit、regenerate、统一错误 |
| `apps/web/src/pages/AdminLogin.tsx` | 登录页 | ✓ VERIFIED | |
| `apps/web/src/pages/AdminChangePassword.tsx` | 改密页 | ✓ VERIFIED | |
| `apps/web/src/pages/AdminDashboard.tsx` | 仪表盘 | ✓ VERIFIED | 3 张「即将开放」卡片 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `README.md` | `docs/DEPLOY.md` | 链接引用 | ✓ WIRED | §机房部署 |
| `docker-entrypoint.sh` | Prisma | migrate deploy + seed | ✓ WIRED | 失败 exit 1 |
| `login.ts` | `session.ts` | regenerate + teacherId | ✓ WIRED | |
| `admin-guard.ts` | `loadSessionUser` | mustChangePassword 闸门 | ✓ WIRED | |
| `api.ts` | `/api/auth/*` | fetch credentials include | ✓ WIRED | 唯一 fetch 封装 |
| `AdminLogin.tsx` | `authApi.login` | onSubmit | ✓ WIRED | |
| `Dockerfile` build | production SPA | COPY dist | ✗ NOT_WIRED | web 构建产物未进入运行镜像 |
| compose `app:3001` | 浏览器首页/登录 | HTTP | ✗ NOT_WIRED | 仅 API |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `AdminDashboard.tsx` | `user.displayName` | `AuthContext` ← `GET /api/auth/me` | DB Teacher 行 | ✓ FLOWING |
| `AdminLogin.tsx` | `formError` | `authApi.login` 401 | 统一错误常量 | ✓ FLOWING |
| `/health` | status | `prisma.$queryRaw SELECT 1` | 真实 DB | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Prisma schema syntax | `pnpm exec prisma validate`（无 DATABASE_URL） | P1012 env missing | ? SKIP |
| Compose 文件有效 | `docker compose config --quiet` | exit 0 | ✓ PASS |
| 登录 API 端到端 | curl 带 DB | 未执行（无运行栈） | ? SKIP |

**Step 7b:** 无可无 DB 运行的认证 curl；已跳过需 Postgres 的检查。

### Probe Execution

无 `scripts/*/tests/probe-*.sh`；本阶段未声明 probe。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 01-01, 01-02 | 部署启动；局域网浏览器访问服务根地址无报错 | ✗ BLOCKED | API/health/文档就绪；**compose 默认路径无法提供首页/登录页** |
| AUTH-01 | 01-03 | 教师凭据登录；未登录不可访问管理功能 | ✓ SATISFIED | 会话 API + SPA 守卫 + admin preHandler（需 Web 可达时验收） |

`REQUIREMENTS.md` 将 AUTH-01 标为 Complete、INFRA-01 为 Pending — 与本次验证一致（INFRA 仍缺浏览器可访问的完整栈）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | 无 TBD/FIXME/XXX | — | — |
| `AdminDashboard.tsx` | 6 | `PLACEHOLDER_CARDS` 常量名 | ℹ️ Info | 非用户可见 stub；卡片为 intentional disabled 预告 |

### Human Verification Required

1. **Compose + 双机 LAN** — 见 frontmatter `human_verification[0]`
2. **浏览器登录全流程** — 见 frontmatter `human_verification[1]`
3. **curl 认证链** — 见 frontmatter `human_verification[2]`

### Gaps Summary

认证与持久化实现质量高：会话存 PostgreSQL、统一登录错误、首登改密闸门、UI-SPEC 文案与路由守卫均在代码中可核对。**阻塞项**是部署交付与 ROADMAP 成功标准 #1 的错位：推荐 Docker 路径只暴露 API，Web 构建在镜像 build 阶段完成却未进入运行态，也未在 compose 中单独暴露。教师在 **`pnpm dev` 或路径 B 手动部署静态资源** 下可走通 AUTH-01，但 **INFRA-01 / SC1 的「浏览器打开首页或登录页」在 compose 一键部署下未达成**。

修复方向（供 `/gsd-plan-phase --gaps`）：在 `apps/server` 托管 `apps/web/dist` 和/或 compose 增加 web 服务；同步修正 README 验收说明。

---

_Verified: 2026-05-15T12:00:00Z_  
_Verifier: Claude (gsd-verifier)_

# 局域网考试系统（LAN Exam）

机房/教室场景的 Web 局域网考试系统。

**协作者 / AI 上下文**：[AGENTS.md](./AGENTS.md)（产品决策、认证模型、代码索引）；完整方案见 [docs/PLAN-考官免登录一键部署.md](./docs/PLAN-考官免登录一键部署.md)。

本仓库为 **pnpm monorepo**：

| 包 | 路径 | 说明 |
| --- | --- | --- |
| `@lan-exam/server` | `apps/server` | Fastify API（开发默认 **3101**；生产单进程 **5180**） |
| `@lan-exam/web` | `apps/web` | Vite + React + TypeScript（开发默认 **5180**） |

开发时 Vite 将 `/api/*` 代理到 API（例如 `/api/health` → `http://127.0.0.1:3101/health`）。生产 / Docker 全栈在 **5180** 由同一 Node 进程托管 API + 静态前端。

## 本地开发（Docker 可选）

Compose 全栈（免登录、单端口 5180）见 [docs/DEPLOY.md](./docs/DEPLOY.md)：

```bash
docker compose up --build
```

启动后：

- 健康检查：`curl -sSf http://127.0.0.1:5180/health`
- 本机管理台：`http://127.0.0.1:5180/admin`

## 本地开发（pnpm，推荐日常）

需 Node.js 20+ 与 [pnpm](https://pnpm.io/) 9+。

```bash
pnpm install
cp .env.example .env   # Windows: copy .env.example .env
pnpm db:up             # Postgres 127.0.0.1:5434
pnpm db:migrate
pnpm db:seed
pnpm dev
```

**考官认证环境变量（须成对设置）**

| 模式 | `.env` |
| --- | --- |
| 免登录（默认，与考场一致） | `ADMIN_AUTH_MODE=disabled` 且 `VITE_ADMIN_AUTH_MODE=disabled` |
| 账号登录（回退） | 两者均为 `session`（或删除 `VITE_*`），并设 `SEED_ADMIN_PASSWORD` 后 `pnpm db:seed` |

未设置时代码与 `.env.example` 默认均为 **disabled**；若只改后端不改 `VITE_*`，会出现前端仍显示登录页而后端已免登录的不一致。

> `pnpm dev` 不自动启动数据库。须先 `pnpm db:up`，且 `DATABASE_URL` 指向 `localhost:5434`（见 `.env.example`）。

- API：`http://127.0.0.1:3101/health`
- Web：`http://127.0.0.1:5180`（管理台 `http://127.0.0.1:5180/admin`）

```bash
pnpm build
```

## 机房部署（考场推荐）

**Windows 原生离线安装**（免 Docker、考官本机免登录、学员 LAN 访问）：

- **[docs/DEPLOY-WINDOWS-NATIVE.md](./docs/DEPLOY-WINDOWS-NATIVE.md)** — `LAN-Exam-Setup.exe`、桌面快捷方式、托盘常驻
- 发版：`.\scripts\windows\package.ps1`（仅在有网构建机执行）

Docker / 反向代理等可选方案见 **[docs/DEPLOY.md](./docs/DEPLOY.md)**。

## 安全与依赖

- 生产镜像使用锁定的 `pnpm-lock.yaml`；定期 `pnpm audit` 并处理高危项。
- **机房默认** `ADMIN_AUTH_MODE=disabled`：考官本机免登录；管理 API 仅 loopback。
- **`session` 模式**（开发回退）：种子账号 `teacher_admin` 首登须改密；勿将弱密码暴露给局域网。
- 从旧 Docker `teacher_admin` 环境升级到免登录后，管理台数据须 **重新导入**（不自动迁移）。

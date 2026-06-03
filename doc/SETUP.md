# 本地环境

## 前置条件

- Node.js **20+**
- [pnpm](https://pnpm.io/) **9+**（见根 `package.json` `packageManager`）
- Docker（仅用于开发库 `pnpm db:up`，或完整 Compose 验收）

## 安装与启动

```bash
git clone <repo>
cd LAN_exam
pnpm install
cp .env.example .env          # Windows: copy .env.example .env
pnpm db:up                    # Postgres 127.0.0.1:5434
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- API：`http://127.0.0.1:3101/health`
- Web：`http://127.0.0.1:5180`
- 管理台：`http://127.0.0.1:5180/admin`（默认免登录）

> `pnpm dev` **不**自动起库；须先 `db:up`，且 `DATABASE_URL` 指向 `localhost:5434`。

## 考官认证（开发）

前后端成对：

| 模式 | `.env` |
|------|--------|
| 免登录（默认，与考场一致） | `ADMIN_AUTH_MODE=disabled` 且 `VITE_ADMIN_AUTH_MODE=disabled` |
| 账号登录（回退） | 两者均为 `session`，并设 `SEED_ADMIN_PASSWORD` 后 `pnpm db:seed` |

## 生产构建

```bash
pnpm build
```

### Windows 考场包（推荐交付）

发版机构（有网，Node 20+、pnpm 9+、.NET 8 SDK、Inno Setup 6）：

```powershell
# 发版前更新仓库根 VERSION
.\scripts\windows\package.ps1
# 产出: dist\LAN-Exam-Setup-v<版本>.exe
```

考场管理机（**无外网**）：U 盘 Setup → 桌面「局域网考试系统」→ `http://127.0.0.1:5180/admin`。

全文：[../docs/DEPLOY-WINDOWS-NATIVE.md](../docs/DEPLOY-WINDOWS-NATIVE.md) · 要点：[DEPLOY.md](DEPLOY.md)

### Docker Compose（开发 / 验收）

```bash
cp .env.docker.example .env
docker compose up -d --build
curl -sSf http://127.0.0.1:5180/health
```

- 仅开发库：`pnpm db:up` 只起 Postgres，**不**起 app 容器。
- 全文：[../docs/DEPLOY-DOCKER.md](../docs/DEPLOY-DOCKER.md)、[../docs/DEPLOY.md](../docs/DEPLOY.md)

### Linux 公网测试（非考场）

```bash
bash scripts/linux/deploy-docker.sh   # 默认对外 8001，写 .env.deploy
```

考官管理台需 SSH 隧道后访问 `127.0.0.1:5180/admin`。见 [../docs/DEPLOY-LINUX-TEST.md](../docs/DEPLOY-LINUX-TEST.md)。

## 常见问题

- **前端仍显示登录页**：只改了 `ADMIN_AUTH_MODE` 未改 `VITE_ADMIN_AUTH_MODE`。
- **migrate 失败**：确认 5434 已监听；工作区有新迁移时须 `pnpm db:migrate`。
- **管理台 403**：非 loopback 访问 `/api/admin/*` 为设计行为。
- **Docker app 容器退出**：`docker compose logs app`；检查 db 健康；session 模式是否缺 `SEED_ADMIN_PASSWORD`。
- **Linux 测试学员连不上**：放行安全组/ufw **8001**（不是 5180）；5180 仅隧道访问管理台用。
- **导入后无旧数据**：免登录视图为 `local_exam_admin`，`teacher_admin` 不迁移。

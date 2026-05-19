# 机房部署指南（LAN Exam）

本文档说明 **Docker Compose 全栈** 与可选反向代理，供开发验收或不用 Windows 安装包的场景。

**考场推荐（免 Docker）**：Windows 离线安装包与托盘常驻见 **[DEPLOY-WINDOWS-NATIVE.md](./DEPLOY-WINDOWS-NATIVE.md)**（`LAN-Exam-Setup.exe`、考官本机免登录 `http://127.0.0.1:5180/admin`）。

本地日常开发见根目录 [README.md](../README.md)（`pnpm dev` = API `3101` + Vite `5180` 代理）。

## 安全假设

- 机房内网默认使用 **HTTP** 明文；若需 HTTPS，在反向代理层终止 TLS（路径 B）。
- 生产镜像默认 **`ADMIN_AUTH_MODE=disabled`**：考官免登录，管理 API 与（免登录下的）`/api/auth/*` 仅本机 loopback；学员经局域网访问 `5180` 的 `/exam/*`。
- 默认数据库口令（`docker-compose.yml` 中的 `lan_exam_dev`）**仅用于开发/Compose**；Windows 原生安装使用安装程序生成的 `.env`。
- `/health` 仅作存活探测，不暴露业务数据。

## 前置条件

- 已安装 [Docker](https://docs.docker.com/get-docker/) 与 Docker Compose v2
- 可拉取镜像（或已配置镜像加速）
- 记录服务器局域网 IP（例如 `192.168.1.100`），供学员机访问

## 数据库迁移与种子

容器启动时依次执行 `prisma migrate deploy` → `prisma db seed` → 应用进程。**任一步失败则容器以非 0 退出**。

### 默认：免登录模式（与 Compose / Dockerfile 一致）

`docker-compose.yml` 中 `app` 已设置：

- `ADMIN_AUTH_MODE=disabled`
- `LOCAL_ADMIN_USERNAME=local_exam_admin`
- `ADMIN_API_LOOPBACK_ONLY=true`

**无需**设置 `SEED_ADMIN_PASSWORD`。种子会 upsert 用户 `local_exam_admin`（密码不可用，仅满足数据 FK）。

| 项 | 说明 |
| --- | --- |
| 种子用户名 | `local_exam_admin`（见 `prisma/seed.ts`） |
| 管理台 | 本机 `http://127.0.0.1:5180/admin`，无登录页 |
| `DATABASE_URL` | Compose 内 `app` 使用主机名 `db`；本机 `pnpm` 开发使用 `127.0.0.1:5434`（见 `.env.example`） |

### 附录：session 模式（开发回退）

若需考官账号登录（`teacher_admin` + 首登改密），在启动前设置：

```bash
# PowerShell 示例
$env:ADMIN_AUTH_MODE = "session"
$env:SEED_ADMIN_PASSWORD = "your-strong-temp-password"
$env:SESSION_SECRET = "dev-session-secret-min-16-chars"
docker compose up --build
```

并重新构建 Web 镜像且 **不要** 设置 `VITE_ADMIN_AUTH_MODE=disabled`（或设为其他非 `disabled` 值）。本地 `pnpm dev` 时 `.env` 中须同时改 `ADMIN_AUTH_MODE` 与 `VITE_ADMIN_AUTH_MODE`。

| 项 | 说明 |
| --- | --- |
| 种子用户名 | `teacher_admin` |
| 首登改密 | `mustChangePassword=true`，登录后须改密 |

### 历史数据说明

从 **session + `teacher_admin`** 切换到 **disabled + `local_exam_admin`** 后，**不做数据迁移**；旧考官账号下的题库/名单/考试在管理台列表中不可见，须在管理台 **重新导入**（与 [PLAN-考官免登录一键部署.md](./PLAN-考官免登录一键部署.md) 决策一致；速览见 [AGENTS.md](../AGENTS.md)）。

验证数据库就绪：

```bash
docker compose logs db
docker compose logs app
# docker compose exec db psql -U lan_exam -d lan_exam -c '\dt'
```

Postgres 宿主机映射 **127.0.0.1:5434** → 容器 `5432`；应用经 Docker 网络访问 `db:5432`。

## 一键启动（Compose）

```bash
# 建议设置 SESSION_SECRET（16 字符以上），Compose 有 dev 默认值
docker compose up --build
```

验收：

```bash
curl -s http://127.0.0.1:5180/health
# 期望: {"status":"ok"}

# 本机管理台（浏览器）
# http://127.0.0.1:5180/admin

# 另一台 LAN 机器：管理 API 应被拒绝
curl -s -o /dev/null -w "%{http_code}" http://<服务器IP>:5180/api/admin/ping
# 期望: 403
```

生产镜像为 **单进程**：`NODE_ENV=production` 时在 **5180** 同时提供 API 与 `apps/web/dist` 静态 SPA（见 `Dockerfile`、`apps/server/src/lib/env.ts`）。

## 路径 A：应用直接监听 0.0.0.0（机房直连）

适用于：无反向代理，学员浏览器直接访问管理机 IP。

### 步骤

1. 确认 `docker-compose.yml` 映射 **`5180:5180`**，`LISTEN_HOST=0.0.0.0`（镜像默认已配置）。
2. 启动：`docker compose up -d --build`
3. **Windows 防火墙**：入站规则放行 TCP **5180**（专用/专用网络配置文件），供考试机访问学员端。
4. 本机：`http://127.0.0.1:5180/admin`（考官操作）。
5. 局域网考试机：`http://<服务器IP>:5180/exam/login`

### 健康检查与回滚

- **健康检查**：`GET http://127.0.0.1:5180/health` → 200，`{"status":"ok"}`。
- **回滚**：保留上一版镜像或 `git checkout` 后 `docker compose up --build`；卷 `postgres_data` 默认保留。

### 注意事项

- 仅 **5180** 需对教室网段开放；Postgres **5434** 仅绑定本机。
- 勿在公网暴露未加 TLS 的 HTTP。

## 路径 B：127.0.0.1 + 反向代理（可选）

适用于：Nginx / IIS 统一 443 入口、TLS 与访问控制。

应用仍监听 **5180**（API + 静态一体）；代理将流量转发到 loopback。

### Nginx 示例（片段）

```nginx
server {
    listen 443 ssl;
    server_name exam.school.local;

    ssl_certificate     /etc/nginx/certs/exam.crt;
    ssl_certificate_key /etc/nginx/certs/exam.key;

    location / {
        proxy_pass http://127.0.0.1:5180;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### IIS

使用 URL Rewrite + ARR 将站点转发到 `http://127.0.0.1:5180`（整站反代，含 `/api` 与 SPA）。

### 健康检查

- 代理层探测：`http://127.0.0.1:5180/health`

## 生产镜像说明

| 项 | 说明 |
| --- | --- |
| 构建 | 多阶段 `Dockerfile`：构建 `web/dist` + `server/dist` |
| 运行 | `node apps/server/dist/index.js`，entrypoint：`migrate` → `seed` → 启动 |
| 环境 | 默认 `ADMIN_AUTH_MODE=disabled`，`WEB_PORT=5180`，`VITE_ADMIN_AUTH_MODE=disabled`（构建期） |
| 开发 | `tsx watch` 仅用于 `pnpm dev`；生产不用 tsx |

## 题库导入

管理端 **题库**（`/admin/questions`）依赖 **exceljs** 解析 `.xlsx`。

| 项 | 说明 |
| --- | --- |
| 权威模板 | `docs/templates/题库导入模板.xlsx` |
| 多选计分 | `multiScoringRule=ALL_OR_NOTHING` |

需已执行含 `Question` / `QuestionImportBatch` 的 Prisma 迁移。

## 常见问题

| 现象 | 排查 |
|------|------|
| `compose up` 后 app 退出 | `docker compose logs app`；`db` 健康检查；session 模式是否缺 `SEED_ADMIN_PASSWORD` |
| 局域网无法访问学员页 | 防火墙 5180；专用网络配置文件 |
| 考试机可访问 `/admin` 页面 | 预期：仅提示「请在本机打开」；`/api/admin/*` 应 403 |
| 导入后看不到旧数据 | 切换免登录后需重新导入，仅 `local_exam_admin` 下数据可见 |
| `/health` 非 200 | 端口 5180 映射与容器日志 |

# 环境变量

> 真实值放在 `.env`（不提交）或安装目录配置；此处只说明含义。完整列表见仓库根 [`.env.example`](../.env.example)。

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | 是 | Postgres 连接串；开发一般为 `localhost:5434` |
| `API_PORT` | 否 | 开发 API 端口，默认 **3101** |
| `WEB_PORT` | 否 | Web/合一端口，默认 **5180** |
| `LISTEN_HOST` | 否 | 绑定地址，开发常 `0.0.0.0` |
| `ADMIN_AUTH_MODE` | 否 | `disabled`（考场免登录）或 `session` |
| `VITE_ADMIN_AUTH_MODE` | 否 | **须与** `ADMIN_AUTH_MODE` 一致 |
| `LOCAL_ADMIN_USERNAME` | 否 | disabled 下数据归属账号，默认 `local_exam_admin` |
| `ADMIN_API_LOOPBACK_ONLY` | 否 | 默认 `true`；机房包勿关 |
| `SEED_ADMIN_PASSWORD` | session 时 | 种子考官密码，勿提交真实值 |
| `SESSION_SECRET` | 生产 | Cookie 签名，≥16 字符 |
| `NODE_ENV` / `SERVE_WEB` | 生产 | 单进程托管前端静态资源 |
| `DATA_DIR` | 否 | 上传根目录，默认 `data/` |
| `MAX_*_BYTES` | 否 | 操作题/填空/截图/ multipart 上限 |
| `EXAM_*_MAX_*` | 否 | 拉卷/交卷/同步削峰（见 `lib/env.ts`） |
| `TRUST_PROXY` | 反代时 | 经 Nginx/IIS 转发时设为 `true` |

### Docker Compose（`.env` / compose 内置）

| 变量名 | 说明 |
|--------|------|
| `WEB_HOST_PORT` | 宿主机 Web/API 映射，默认 **5180** |
| `DB_HOST_PORT` | Postgres 宿主机映射，默认 **5434**（仅 127.0.0.1） |
| `SESSION_SECRET` | Compose 有占位值；**生产务必改为 ≥16 字符随机串** |

Compose `app` 服务固定：`ADMIN_AUTH_MODE=disabled`、`DATA_DIR=/app/data`、DB 主机名 `db`。默认**不需要** `SEED_ADMIN_PASSWORD`。

### Linux 测试（`.env.deploy`，gitignore）

| 变量名 | 说明 |
|--------|------|
| `WEB_HOST_PORT` | 默认 **8001**（与考场 5180 不同） |
| `SESSION_SECRET` | `deploy-docker.sh` 可自动生成 |

由 `scripts/linux/deploy-docker.sh` 写入；**不覆盖**开发者本机 `.env`。

### Windows Setup

安装程序生成安装目录 `.env`（含随机 `SESSION_SECRET`）。勿把生产值写入 `doc/`。

## 获取方式

- **开发**：复制 `.env.example` 为 `.env`。
- **Docker 验收**：`.env.docker.example` + `docker compose`。
- **Linux 服务器**：`deploy-docker.sh` → `.env.deploy`。
- **Windows Setup**：安装脚本写入安装目录。

## 相关文档

- [SETUP.md](SETUP.md) — 启动顺序
- [DEPLOY.md](DEPLOY.md) — 三路径与环境文件对照
- [../docs/DEPLOY.md](../docs/DEPLOY.md) — 上传限制与 Compose 默认值全文
- [../AGENTS.md](../AGENTS.md) — 认证与安全假设

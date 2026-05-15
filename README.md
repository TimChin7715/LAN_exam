# 局域网考试系统（LAN Exam）

机房/教室场景的 Web 局域网考试系统。本仓库为 **pnpm monorepo**：

| 包 | 路径 | 说明 |
| --- | --- | --- |
| `@lan-exam/server` | `apps/server` | Fastify API（默认端口 **3001**） |
| `@lan-exam/web` | `apps/web` | Vite + React + TypeScript（默认端口 **5173**） |

前端开发时通过 Vite 将 `/api/*` 代理到 API 服务（例如 `/api/health` → `http://127.0.0.1:3001/health`）。

## 本地开发（Docker 优先）

推荐与生产一致的 Docker 环境（见 [docs/DEPLOY.md](./docs/DEPLOY.md)）：

```bash
docker compose up --build
```

启动后：

- 健康检查：`curl -sSf http://127.0.0.1:3001/health`（Compose 映射端口以 `docker-compose.yml` 为准）
- 浏览器访问 Web：见 compose 中 `app` 服务暴露的端口

## 本地开发（pnpm，可选）

需 Node.js 20+ 与 [pnpm](https://pnpm.io/) 9+。

```bash
pnpm install
pnpm dev          # 并行启动 server + web
# 或分别：pnpm dev:server / pnpm dev:web
```

- API：`http://127.0.0.1:3001/health` → `{"status":"ok"}`
- Web：`http://127.0.0.1:5173`

构建：

```bash
pnpm build
```

## 机房部署

生产/考场部署步骤、双路径网络验收与安全假设见 **[docs/DEPLOY.md](./docs/DEPLOY.md)**（权威文档）。

## 安全与依赖

- 生产镜像使用锁定的 `pnpm-lock.yaml` 构建；定期执行 `pnpm audit` 并跟进高危项。
- 默认数据库口令仅用于开发/种子阶段；正式环境须在首登后改密（后续认证计划）。

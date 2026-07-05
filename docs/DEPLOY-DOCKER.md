# Docker 部署使用说明（LAN Exam）

> **说明**：考场现场推荐 [Windows 离线安装包](./DEPLOY-WINDOWS-NATIVE.md)。Docker 适用于开发机验收、机房临时环境、或已有 Docker 运维体系的部署。完整运维细节见 [DEPLOY.md](./DEPLOY.md)。

## 一、前置条件

| 项 | 要求 |
| --- | --- |
| Docker | 20.10+，含 Compose v2（`docker compose`） |
| 内存 / 磁盘 | 建议 ≥ 2GB 可用内存；数据卷预留题库与上传空间 |
| 网络 | 构建镜像需能拉取 `node:22-bookworm-slim`、`postgres:16`（或提前导入离线镜像） |
| 防火墙 | 对教室网段放行 **TCP 5180**；**不要**对 LAN 开放 Postgres 端口 |

## 二、推荐方式：Docker Compose 一键启动

在项目根目录执行：

```bash
# 1.（可选）复制并编辑环境变量
cp .env.docker.example .env

# 2. 构建并启动（前台）
docker compose up --build

# 或后台运行
docker compose up -d --build
```

默认会启动两个服务：

| 服务 | 镜像 | 端口 | 说明 |
| --- | --- | --- | --- |
| `db` | `postgres:16` | 宿主机 `127.0.0.1:5434` → 容器 5432 | 仅本机可连，勿暴露到局域网 |
| `app` | 本地构建 `lan-exam:latest` | 宿主机 `5180` → 容器 5180 | API + 前端 SPA 单进程 |

启动流程（容器内自动执行）：`prisma migrate deploy` → `prisma db seed` → `node apps/server/dist/index.js`。

### 验收

```bash
# 健康检查
curl -s http://127.0.0.1:5180/health
# 期望: {"status":"ok"}

# 本机考官管理台（默认免登录）
# 浏览器打开: http://127.0.0.1:5180/admin

# 学员端（将 <管理机IP> 换为实际局域网 IP）
# http://<管理机IP>:5180/exam/login
```

从**另一台**局域网机器访问管理 API 应被拒绝（403）：

```bash
curl -s -o /dev/null -w "%{http_code}" http://<管理机IP>:5180/api/admin/ping
# 期望: 403
```

### 常用命令

```bash
docker compose ps
docker compose logs -f app
docker compose logs db
docker compose down          # 停止，保留数据卷
docker compose down -v       # 停止并删除数据库与上传卷（慎用）
```

### 环境变量（`.env` 或 shell）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `SESSION_SECRET` | compose 内置占位值 | **生产务必改为 16 字符以上随机串** |
| `WEB_HOST_PORT` | `5180` | 宿主机映射 Web/API 端口 |
| `DB_HOST_PORT` | `5434` | 宿主机映射 Postgres（仅 127.0.0.1） |

Compose 内 `app` 已固定：`ADMIN_AUTH_MODE=disabled`、`DATA_DIR=/app/data`、数据库连接指向服务名 `db`。

## 三、仅构建应用镜像

不启动数据库、只打应用镜像时：

```bash
# Linux / macOS / Git Bash
./scripts/docker/build-image.sh

# Windows PowerShell
.\scripts\docker\build-image.ps1
```

或手动指定标签（版本号见仓库根目录 `VERSION`）：

```bash
docker build -t lan-exam:1.6.3 -t lan-exam:latest .
```

镜像内已包含：编译后的 API、`apps/web/dist` 静态资源、`prisma` 迁移、`templates/` 导入模板。默认考官模式为 **免登录**（`local_exam_admin`）。

### 离线分发镜像

在有网的构建机上（Windows 一键脚本）：

```powershell
.\scripts\docker\package-images.ps1
```

导出目录默认为项目根下 `docker-images/`：

| 文件 | 镜像 |
| --- | --- |
| `docker-images/postgres-16.tar` | `postgres:16` |
| `docker-images/lan-exam-<VERSION>.tar` | `lan-exam:<VERSION>`、`lan-exam:latest` |

在目标机器导入：

```powershell
docker load -i docker-images\postgres-16.tar
docker load -i docker-images\lan-exam-1.6.3.tar
```

再在目标机使用同一套 `docker-compose.yml` 启动（无需 `--build`，若 `app.image` 已指向 `lan-exam:latest`）。

## 四、仅运行应用容器（自带外部 Postgres）

适用于已有数据库、或 Compose 只跑 `app` 的场景：

```bash
docker run -d --name lan-exam-app \
  -p 5180:5180 \
  -e DATABASE_URL="postgresql://用户:密码@数据库主机:5432/lan_exam" \
  -e SESSION_SECRET="请替换为至少16字符的随机串" \
  -e ADMIN_AUTH_MODE=disabled \
  -e ADMIN_API_LOOPBACK_ONLY=true \
  -e DATA_DIR=/app/data \
  -v lan_exam_uploads:/app/data \
  lan-exam:latest
```

注意：

- 首次启动前，数据库须可连接且空库或已迁移；容器 entrypoint 会执行 `migrate deploy` 与 `seed`。
- 持久化上传、答卷、截图等务必挂载 `-v` 到 `/app/data`。

## 五、默认认证与数据归属

| 模式 | 环境变量 | 管理台 |
| --- | --- | --- |
| 免登录（默认） | `ADMIN_AUTH_MODE=disabled` | 仅本机 `http://127.0.0.1:5180/admin` |
| 账号登录（开发回退） | `ADMIN_AUTH_MODE=session` + `SEED_ADMIN_PASSWORD` | 需重新构建前端且 `VITE_ADMIN_AUTH_MODE=session` |

**历史数据**：从旧版 `teacher_admin` 切换到 `local_exam_admin` 后不会自动迁移，需在管理台重新导入题库与名单。

## 六、数据持久化

Compose 默认卷：

| 卷名 | 挂载点 | 内容 |
| --- | --- | --- |
| `postgres_data` | Postgres 数据目录 | 考试、名单、成绩等 |
| `uploads_data` | `/app/data` | 操作题批次、学员答卷、截图 |

备份建议：考后备份上述两个 Docker volume，或定期 `docker compose exec db pg_dump ...` 导出 SQL。

## 七、生产注意

1. **修改 `SESSION_SECRET`**，不要使用 compose 默认值。
2. **5434 仅绑定 127.0.0.1**（`docker-compose.yml` 已配置），勿改为 `0.0.0.0`。
3. 机房内网使用 HTTP 即可；若上 HTTPS，在 Nginx/IIS 反向代理层终止 TLS，并设置 `TRUST_PROXY=true`（见 [DEPLOY.md](./DEPLOY.md) 路径 B）。
4. 大文件上传失败时，检查 `MAX_PRACTICAL_*`、`MAX_FILLIN_SCREENSHOT_BYTES` 与 `MULTIPART_MAX_FILE_BYTES`（见 `.env.example`）。
5. Linux 公网联调（宿主机 **8001**）见 [DEPLOY-LINUX-TEST.md](./DEPLOY-LINUX-TEST.md)，与本文默认 **5180** 方案独立。

## 八、故障排查

| 现象 | 处理 |
| --- | --- |
| `app` 容器反复退出 | `docker compose logs app`；确认 `db` 健康；session 模式是否未设 `SEED_ADMIN_PASSWORD` |
| `Cannot connect to Docker` | 启动 Docker Desktop / Docker 守护进程 |
| 学员打不开登录页 | 检查防火墙 5180、管理机 LAN IP、`WEB_HOST_PORT` |
| 管理台提示“请在本机打开” | 预期行为；远程打开 `/admin` 仅提示，API 仍 403 |
| `/health` 非 200 | `docker compose ps`；端口是否被占用；查看 `app` 日志 |

## 九、相关文件

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | 多阶段构建 Web + API 生产镜像 |
| `docker-compose.yml` | 本地 / 机房 Compose 全栈（5180 + Postgres） |
| `docker-compose.host-app.yml` | Linux 测试：仅 app，DB 用宿主机网络 |
| `scripts/docker-entrypoint.sh` | 迁移、种子、启动 Node |
| `.env.docker.example` | Compose 可选环境变量模板 |
| `scripts/docker/build-image.sh` | 构建并打标签 |
| `scripts/docker/build-image.ps1` | Windows 构建脚本 |

# 机房部署指南（LAN Exam）

本文档为考场/机房环境部署的**权威说明**。开发环境默认使用 Docker（见根目录 `README.md`）。

## 安全假设

- **本阶段（Phase 1 骨架）** 默认在机房内网使用 **HTTP** 明文传输；不在应用层强制 TLS。
- 若需 HTTPS，应在 **路径 B** 的反向代理层终止 TLS（证书由机房运维管理），应用仍监听 loopback HTTP。
- 默认数据库口令（`docker-compose.yml` 中的 `lan_exam_dev`）**仅用于开发/种子**；正式环境须在首登后改密（见后续认证计划）。
- `/health` 仅作存活探测，不暴露业务数据；大规模探测应由防火墙或网关限流。

## 前置条件

- 已安装 [Docker](https://docs.docker.com/get-docker/) 与 Docker Compose v2
- 服务器可访问 Docker Hub（或已配置镜像加速）
- 记录服务器局域网 IP（例如 `192.168.1.100`）

## 一键启动（开发/验收）

```bash
docker compose up --build
```

验收：

```bash
# 健康检查（端口以 compose 映射为准，默认 3001）
curl -s http://127.0.0.1:3001/health
# 期望: {"status":"ok"}
```

## 路径 A：应用直接监听 0.0.0.0（机房直连）

适用于：无反向代理、学员/教师浏览器直接访问应用端口。

### 步骤

1. 在 `docker-compose.yml` 或环境变量中确认 `HOST=0.0.0.0`、`PORT=3001`（默认已配置）。
2. 启动：`docker compose up -d --build`
3. **Windows 防火墙**：入站规则放行 TCP `3001`（及后续 Web 端口，若单独暴露）。
   - `wf.msc` → 入站规则 → 新建规则 → 端口 → TCP 3001 → 允许连接 → 域/专用配置文件勾选。
4. 在**局域网另一台机器**浏览器访问：`http://<服务器IP>:3001/health`，应返回 JSON `status: ok`。
5. 正式 Web 前端上线后，同样放行对应端口（默认开发 Web `5173`，生产以 compose 为准）。

### 健康检查与回滚

- **健康检查**：`GET /health` 返回 200 且 body 含 `"status":"ok"`。
- **回滚**：保留上一版镜像 tag 或 `git checkout` 上一发布 commit 后重新 `docker compose up --build`；数据库卷 `postgres_data` 默认保留，回滚应用不会自动清库——需运维按需备份/恢复。

### 注意事项

- 路径 A 将 API 端口暴露在内网，务必配合防火墙仅允许教室网段访问。
- 不要在公网直接暴露未加 TLS 的 HTTP。

## 路径 B：监听 127.0.0.1 + 反向代理（推荐生产）

适用于：由 Nginx / IIS 统一入口、在代理层做 TLS 与访问控制。

### 为何在代理层 TLS

- 应用进程无需持有证书，降低密钥泄露面。
- 机房可复用既有 Nginx/IIS 证书与 WAF 策略。
- 多服务可共用一个 443 入口。

### 步骤

1. 将应用绑定到 **loopback**：设置 `HOST=127.0.0.1`（仅本机可连 API 端口）。
2. 启动 Compose 后，API 在 `127.0.0.1:3001` 可用。
3. **Nginx 示例**（片段）：

```nginx
server {
    listen 443 ssl;
    server_name exam.school.local;

    ssl_certificate     /etc/nginx/certs/exam.crt;
    ssl_certificate_key /etc/nginx/certs/exam.key;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        # 生产静态资源目录（构建后由运维同步 apps/web/dist）
        root /var/www/lan-exam/web;
        try_files $uri $uri/ /index.html;
    }
}
```

4. **IIS**：使用 URL Rewrite + ARR 将 `/api` 转发到 `http://127.0.0.1:3001`，静态站点指向 Web 构建产物目录。
5. 学员访问：`https://exam.school.local/`（由代理提供 TLS）。

### 健康检查与回滚

- 代理层可对 `http://127.0.0.1:3001/health` 做主动探测。
- 回滚：切换 Nginx `proxy_pass` 至旧容器端口，或 `docker compose` 切回上一镜像；代理配置变更前备份 `sites-enabled`。

## 生产镜像说明

- 多阶段 `Dockerfile`：构建 `@lan-exam/web` 与 `@lan-exam/server`，运行入口为 `node apps/server/dist/index.js`。
- 开发可用 `tsx watch`；**生产不使用 tsx**，仅 `node` 运行编译产物。
- 构建使用锁定的 `pnpm-lock.yaml`；发布前建议 `pnpm audit` 并处理高危项。

## 常见问题

| 现象 | 排查 |
|------|------|
| `compose up` 后 app 退出 | `docker compose logs app`；确认 `db` 健康检查通过 |
| 局域网无法访问 | 路径 A 检查防火墙与 `HOST`；路径 B 检查代理与 DNS |
| `/health` 非 200 | 确认端口映射与进程监听地址 |

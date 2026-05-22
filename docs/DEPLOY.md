# Compose / 反向代理部署手册（LAN Exam）

本文档用于 **Docker Compose 全栈部署、开发验收环境、反向代理运维**。  
**考场推荐方案不是 Docker**，而是 Windows 离线安装包；现场操作见 [DEPLOY-WINDOWS-NATIVE.md](./DEPLOY-WINDOWS-NATIVE.md)。

本地日常开发入口见 [README.md](../README.md)，维护者上下文见 [AGENTS.md](../AGENTS.md)。

## 适用场景

- 开发机需要一键起全栈服务
- 验收环境暂时不使用 Windows 原生安装包
- 需要在 Nginx / IIS 后面挂单进程应用
- 需要验证 5180 单端口部署、免登录、上传、导出、座位表等当前能力

## 安全假设

- 机房内网默认使用 **HTTP**；若需 HTTPS，在反向代理层终止 TLS。
- 生产镜像默认 **`ADMIN_AUTH_MODE=disabled`**：
  - 考官本机免登录
  - `/api/admin/*` 与 disabled 模式下 `/api/auth/*` 仅本机 loopback
  - 学员经局域网访问 `5180` 的 `/exam/*`
- `docker-compose.yml` 里的数据库口令 `lan_exam_dev` 仅用于 Compose / 开发，不用于 Windows 考场包。
- `/health` 仅作存活探测，不暴露业务数据。

## 前置条件

- 已安装 [Docker](https://docs.docker.com/get-docker/) 与 Docker Compose v2
- 可拉取镜像或已配置镜像加速
- 知道管理机局域网 IP（例如 `192.168.1.100`），供学员访问

## 运行模型

| 组件 | 行为 |
| --- | --- |
| Web + API | 单 Node 进程监听 `5180`，同时托管 SPA 与 `/api/*` |
| Postgres | 宿主机 `127.0.0.1:5434` 映射到容器 `5432` |
| 管理台 | 仅本机 `http://127.0.0.1:5180/admin` |
| 学员端 | `http://<管理机IP>:5180/exam/*` |

容器启动顺序：`prisma migrate deploy` → `prisma db seed` → 应用进程。任一步失败则容器退出。

## 默认环境变量

`docker-compose.yml` 中 `app` 默认已设置：

- `ADMIN_AUTH_MODE=disabled`
- `LOCAL_ADMIN_USERNAME=local_exam_admin`
- `ADMIN_API_LOOPBACK_ONLY=true`
- `WEB_PORT=5180`
- `LISTEN_HOST=0.0.0.0`
- `DATA_DIR=/app/data`

默认无需设置 `SEED_ADMIN_PASSWORD`。种子会 upsert `local_exam_admin`，仅作为数据归属用户存在，不用于登录。

## 一键启动（Compose）

```bash
# 建议额外提供 SESSION_SECRET（16 字符以上）
docker compose up --build
```

启动后验收：

```bash
curl -s http://127.0.0.1:5180/health
# 期望: {"status":"ok"}

# 本机管理台
# http://127.0.0.1:5180/admin

# 另一台 LAN 机器：管理 API 应被拒绝
curl -s -o /dev/null -w "%{http_code}" http://<管理机IP>:5180/api/admin/ping
# 期望: 403
```

查看日志：

```bash
docker compose logs db
docker compose logs app
```

## 账号登录回退（仅开发 / 兼容验证）

若需恢复考官账号登录（`teacher_admin` + 首登改密）：

```bash
# PowerShell 示例
$env:ADMIN_AUTH_MODE = "session"
$env:SEED_ADMIN_PASSWORD = "your-strong-temp-password"
$env:SESSION_SECRET = "dev-session-secret-min-16-chars"
docker compose up --build
```

同时不要让前端继续使用 `VITE_ADMIN_AUTH_MODE=disabled`。本地 `pnpm dev` 与镜像构建都必须保持前后端模式一致。

## 历史数据约束

从 **session + `teacher_admin`** 切换到 **disabled + `local_exam_admin`** 后：

- 不做数据迁移
- 旧考官账号下的题库 / 名单 / 考试不会出现在当前管理台列表
- 需重新导入到 `local_exam_admin`

这是当前产品决策，不要在部署文档中暗示自动迁移。

## 当前功能运维面

### 1. 导入资源

管理台导入入口：

- 客观题：`/admin/questions`
- 填空题：`/admin/questions` → “填空题”
- 操作题：`/admin/questions` → “操作题”
- 名单：`/admin/roster`

| 模块 | 支持文件 | 规则 |
| --- | --- | --- |
| 客观题 | `.xls` / `.xlsx` / `.csv` | 使用 `templates/题库导入模板.xlsx` |
| 名单 | `.xls` / `.xlsx` / `.csv` | 使用 `templates/名单导入模板.xlsx`；列为“姓名 / 单位 / 身份证号” |
| 填空题 | Word 题目 + `.xls` / `.xlsx` 答题卡 + 可选 `.xls` / `.xlsx` / `.csv` 附件 | 答题卡工作表名必须为 `答题卡`，列为“题号 / 答案 / 分值” |
| 操作题 | Word 试卷 + `.xls` / `.xlsx` / `.csv` 附件 | 不自动计分，无固定题库模板 |

补充说明：

- 填空题 Word 只做全文展示，不要求与答题卡逐题对应。
- 填空题答题卡一行代表一空；答案列可用 `|` 分隔多个可接受答案。
- 客观题多选当前计分规则为 `ALL_OR_NOTHING`。

### 2. 创建考试

在 `/admin/exams` 可创建混合考试：

- 内容模块可多选：`OBJECTIVE`、`FILL`、`PRACTICAL`
- 每个启用模块都必须绑定对应批次
- 必须选择一份名单批次
- 设置开始 / 结束时间后，考试初始状态为 `DRAFT`

### 3. 考中行为

- 开始考试后，学员用姓名 + 身份证号在 `/exam/login` 登录。
- 若设置页 `showSeatBoard=true`，学员登录页与考试详情会展示座位表。
- 座位分配按考试自动随机生成，首次读取座位表时若无记录会补分配。
- 客观题 / 填空题自动保存；填空题每空可上传或粘贴截图（PNG / JPEG / WebP，每空最多 5 张，单张默认不超过 5MB）作为作答佐证，**不参与自动评分**。
- 操作题需先上传作答文档后才允许交卷。
- 已交卷学员进入 `/exam/submitted`，等待考官结束考试；考试结束后统一进入 `/exam/ended`。

### 4. 考后处理

在 `/admin/exams/:id`：

- 可导出成绩与答题明细 Excel
- 若考试含填空题，可导出已交卷学员的填空题截图 ZIP（按学员分文件夹，文件名为 `第x题` / `第x题1`…；无已交卷截图时导出失败）
- 若考试含操作题，可逐人下载操作题答卷
- 自动总分只包含客观题与填空题（截图不计分）；操作题需人工评阅

在 `/admin/settings`：

- 可开启 / 关闭座位表展示
- 可执行“清除全部数据”

“清除全部数据”会删除：

- 当前考官账号下全部考试
- 客观题题库
- 填空题批次
- 操作题批次
- 名单批次
- 关联上传文件与学员答卷

“清除全部数据”不会删除：

- 当前设置项（如 `showSeatBoard`）
- PostgreSQL 本身
- 程序安装文件

## 上传、存储与大小限制

| 项 | 说明 |
| --- | --- |
| `DATA_DIR` | 上传与衍生文件目录；Compose 默认挂载到 `/app/data`；学员截图位于 `exam-work/{examId}/{rosterEntryId}/fill-in/` |
| `MAX_PRACTICAL_DOCX_BYTES` | Word 试卷 / 学员操作题答卷上限，默认 20MB |
| `MAX_PRACTICAL_XLSX_BYTES` | 操作题 / 填空题附件上限，默认 10MB |
| `MAX_FILLIN_SCREENSHOT_BYTES` | 填空题每空单张截图上限，默认 5MB；格式 PNG / JPEG / WebP，每空最多 5 张（代码常量） |
| `MULTIPART_MAX_FILE_BYTES` | Fastify multipart 单文件上限，必须不小于 practical、附件与截图等各类单文件上限中的最大值 |

若导入或上传出现 `request file too large`，优先检查 `MULTIPART_MAX_FILE_BYTES`。

## 路径 A：应用直接监听 `0.0.0.0`

适用于：无反向代理，学员浏览器直接访问管理机 IP。

1. 确认 `docker-compose.yml` 映射 `5180:5180`
2. 启动：`docker compose up -d --build`
3. 放行管理机防火墙 TCP `5180`
4. 本机访问 `http://127.0.0.1:5180/admin`
5. 学员访问 `http://<管理机IP>:5180/exam/login`

注意：

- 仅 `5180` 需对教室网段开放
- Postgres `5434` 必须保持仅本机绑定
- 不要把未加 TLS 的 HTTP 暴露到公网

## 路径 B：反向代理（可选）

适用于：Nginx / IIS 统一入口、TLS、额外访问控制。

应用仍监听 `127.0.0.1:5180` 或 `0.0.0.0:5180`，代理将整站流量转发到该端口。建议同时设置：

```env
TRUST_PROXY=true
```

### Nginx 示例

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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### IIS

使用 URL Rewrite + ARR 将整站转发到 `http://127.0.0.1:5180`，含 `/api` 与 SPA 路由。

### 健康检查

- 代理层探测：`http://127.0.0.1:5180/health`

## 生产镜像说明

| 项 | 说明 |
| --- | --- |
| 构建 | 多阶段 `Dockerfile`：构建 `web/dist` + `server/dist` |
| 运行 | `node apps/server/dist/index.js`；entrypoint 先执行 migrate / seed |
| 环境 | 默认 `ADMIN_AUTH_MODE=disabled`、`WEB_PORT=5180`、构建期 `VITE_ADMIN_AUTH_MODE=disabled` |
| 开发 | `tsx watch` 仅用于 `pnpm dev`，生产不用 |

## 常见问题

| 现象 | 排查 |
| --- | --- |
| `docker compose up` 后 `app` 退出 | `docker compose logs app`；检查 `db` 健康状态；session 模式是否缺 `SEED_ADMIN_PASSWORD` |
| 学员无法访问 `/exam/login` | 防火墙 `5180`；局域网 IP；Compose 端口映射 |
| 考试机能打开 `/admin` | 页面提示“请在本机打开”属预期；`/api/admin/*` 应返回 `403` |
| 导入后看不到旧数据 | 当前为 `local_exam_admin` 数据视图；旧 `teacher_admin` 数据不会自动迁移 |
| 填空题导入失败 | 检查答题卡是否为 `.xls/.xlsx`，工作表名是否为 `答题卡`，列是否为“题号 / 答案 / 分值” |
| 上传大文件失败 | 检查 `MAX_PRACTICAL_*`、`MAX_FILLIN_SCREENSHOT_BYTES` 与 `MULTIPART_MAX_FILE_BYTES` |
| `/health` 非 200 | 检查 `5180` 端口映射、应用日志、数据库就绪情况 |

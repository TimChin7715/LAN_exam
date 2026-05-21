# 局域网考试系统（LAN Exam）

机房 / 教室场景的 Web 局域网考试系统：管理机兼服务器，考官只在本机管理台操作，学员经局域网访问考试端。

| 角色 | 地址 | 认证 |
| --- | --- | --- |
| 考官（管理台） | `http://127.0.0.1:5180/admin` | 默认免登录；仅本机访问 |
| 学员 | `http://<管理机LAN_IP>:5180/exam/*` | 名单校验：姓名 + 身份证号 |

## 当前能力

- 客观题：Excel 题库导入，支持单选 / 多选 / 判断，成绩自动统计并导出。
- 填空题：Word 试卷全文展示 + Excel 答题卡自动判分，可附带额外表格附件供学员下载。
- 操作题：Word 试卷 + Excel / CSV 附件下发，学员上传 `.doc` / `.docx` 作答，考官下载后人工评阅。
- 名单管理：按“姓名 / 单位 / 身份证号”批量导入；学员以姓名和身份证号登录。
- 考试流程：草稿 / 进行中 / 已结束，支持混合考试（客观题 + 填空题 + 操作题任意组合）。
- 座位表：考试创建后自动随机分配座位，可在设置页开启或关闭学员端 / 管理端展示。
- 考后整理：导出成绩（含成绩汇总、客观题答题明细、填空题明细三个工作表）、下载操作题答卷、按需清除当前考场全部业务数据。

## 文档导航

| 文档 | 适合谁看 | 用途 |
| --- | --- | --- |
| [README.md](./README.md) | 新读者 / 新工程 | 产品能力、开发入口、文档索引 |
| [AGENTS.md](./AGENTS.md) | 维护者 / AI 协作者 | 产品约束、认证模型、关键代码落点 |
| [docs/DEPLOY-WINDOWS-NATIVE.md](./docs/DEPLOY-WINDOWS-NATIVE.md) | 考场实施 / 运维 | Windows 离线安装、考前考后操作 |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | 开发运维 / 验收环境 | Docker Compose、反向代理、上传与运维约束 |
| [docs/PLAN-考官免登录一键部署.md](./docs/PLAN-考官免登录一键部署.md) | 决策追踪 | 免登录 + Windows 原生部署方案、验收与风险（非产品说明书） |
| [apps/server/src/plugins/README.md](./apps/server/src/plugins/README.md) | 后端维护者 | Fastify 插件与 admin/student 守卫索引 |

## 仓库结构

本仓库为 **pnpm monorepo**：

| 包 | 路径 | 说明 |
| --- | --- | --- |
| `@lan-exam/server` | `apps/server` | Fastify API（开发默认 **3101**；生产单进程 **5180**） |
| `@lan-exam/web` | `apps/web` | Vite + React + TypeScript（开发默认 **5180**） |

开发时 Vite 将 `/api/*` 代理到 API。生产 / Docker / Windows 原生安装在 **5180** 由同一 Node 进程托管 API + 静态前端。

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

> `pnpm dev` 不自动启动数据库。须先 `pnpm db:up`，且 `DATABASE_URL` 指向 `localhost:5434`（见 `.env.example`）。

- API：`http://127.0.0.1:3101/health`
- Web：`http://127.0.0.1:5180`
- 管理台：`http://127.0.0.1:5180/admin`

```bash
pnpm build
```

### 考官认证环境变量

前后端必须成对设置：

| 模式 | `.env` |
| --- | --- |
| 免登录（默认，与考场一致） | `ADMIN_AUTH_MODE=disabled` 且 `VITE_ADMIN_AUTH_MODE=disabled` |
| 账号登录（开发回退） | 两者均为 `session`（或删除 `VITE_*`），并设 `SEED_ADMIN_PASSWORD` 后重新 `pnpm db:seed` |

未设置时代码与 `.env.example` 默认均为 **disabled**。若只改后端不改 `VITE_*`，会出现前端仍显示登录页而后端已免登录的不一致。

## 可选：Docker Compose 开发 / 验收

Compose 全栈（免登录、单端口 5180）见 [docs/DEPLOY.md](./docs/DEPLOY.md)：

```bash
docker compose up --build
```

启动后：

- 健康检查：`curl -sSf http://127.0.0.1:5180/health`
- 本机管理台：`http://127.0.0.1:5180/admin`

## 机房部署（推荐）

**Windows 原生离线安装** 是考场推荐交付方式：

- 安装包：`LAN-Exam-Setup.exe`
- 形态：桌面快捷方式 + 托盘常驻 + 便携 Node / Postgres
- 现场要求：考场机器不访问外网

具体操作见 [docs/DEPLOY-WINDOWS-NATIVE.md](./docs/DEPLOY-WINDOWS-NATIVE.md)。  
发版在有网构建机执行：`.\scripts\windows\package.ps1`

Docker / 反向代理等可选方案见 [docs/DEPLOY.md](./docs/DEPLOY.md)。

## 导入与文件格式

| 模块 | 输入文件 | 说明 |
| --- | --- | --- |
| 名单 | `.xls` / `.xlsx` / `.csv` | 表头为“姓名 / 单位 / 身份证号” |
| 客观题 | `.xls` / `.xlsx` / `.csv` | 使用官方题库模板 |
| 填空题 | Word 题目 + Excel 答题卡 + 可选附件 | 答题卡仅支持 `.xls` / `.xlsx`，工作表名 `答题卡`，列为“题号 / 答案 / 分值” |
| 操作题 | Word 试卷 + Excel / CSV 附件 | 不自动计分，考官下载答卷后人工评阅 |

上传与存储相关环境变量见 `.env.example`：`DATA_DIR`、`MAX_PRACTICAL_DOCX_BYTES`、`MAX_PRACTICAL_XLSX_BYTES`、`MULTIPART_MAX_FILE_BYTES`。

## 安全与数据约束

- 机房默认 `ADMIN_AUTH_MODE=disabled`：考官本机免登录；`/api/admin/*` 与 disabled 模式下 `/api/auth/*` 仅 loopback。
- 管理机只对学员开放 `5180`；Postgres `5434` 仅本机。
- HTTP 仅面向机房内网，勿设计公网暴露。
- 从旧 `teacher_admin` 环境切换到免登录后，管理台数据 **不会自动迁移**；须重新导入到 `local_exam_admin`。
- 生产镜像依赖锁定的 `pnpm-lock.yaml`；常规维护仍应执行依赖审计与升级。

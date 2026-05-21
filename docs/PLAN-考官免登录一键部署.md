# 考官免登录 + Windows 原生一键部署方案

> **文档定位**：部署与认证**决策档案**（验收表、风险、Phase 清单）。**不**作为通用产品说明。  
> 方案版本：2026-05-20 · 状态：**Phase A / B 已落地**（双机真机验收待考场执行）

| 需要了解 | 请看 |
| --- | --- |
| 产品当前能力、开发冷启动 | [README.md](../README.md) |
| 维护者 / Agent 权威上下文 | [AGENTS.md](../AGENTS.md) |
| 考场 U 盘安装与考前考后操作 | [DEPLOY-WINDOWS-NATIVE.md](./DEPLOY-WINDOWS-NATIVE.md) |
| Docker Compose / 反代运维 | [DEPLOY.md](./DEPLOY.md) |

根目录 [PLAN-考官免登录一键部署.md](../PLAN-考官免登录一键部署.md) 仅为跳转页。Cursor 硬约束：`.cursor/rules/lan-exam-product.mdc`。

> 概述：将 `http://127.0.0.1:5180/admin` 作为**仅安装机本机**可操作的免登录管理台；学员经局域网 `http://<管理机IP>:5180/exam` 考试（**姓名 + 身份证号**登录）。交付形态为 **离线一体化 Inno Setup（`.exe`）+ 桌面快捷方式 + 托盘常驻**（内含 Node、Postgres、VC++ 运行库，考场**无需外网**）；管理相关 API 仅 loopback。

## 决策记录（已确认）

| # | 议题 | 结论 |
| --- | --- | --- |
| 1 | 交付形态与考官端访问 | **必须**提供 Inno Setup 安装程序（`LAN-Exam-Setup.exe`）与桌面快捷方式；**仅安装机（本机 loopback）** 可正常使用考官管理台（UI + 管理/认证 API） |
| 2 | 历史数据 | **不做迁移**；免登录后绑定 `local_exam_admin`，旧 `teacher_admin` 数据**不可见**，仅新导入数据可用（甲方已接受） |
| 3 | 进程与退出 | 关闭安装/控制台窗口 → **最小化到系统托盘**，Postgres + Node **继续后台运行**；仅在托盘菜单选择「退出」时停止全部服务 |
| 4 | 防火墙与拓扑 | 考试机与管理机在同一局域网；安装时**自动添加入站规则**放行管理机 **TCP 5180**（专用/专用网络配置文件），供考试机访问学员端；5434 仍仅本机 |
| 5 | Phase B 必交付 | **Inno Setup `.exe` + 桌面快捷方式** 为验收必选项（非 Phase C 可选项）；可同时附带绿色 zip 供实施备份 |
| 6 | **离线局域网** | 考场/机房 **不能访问互联网**（含微软官网）；**禁止**安装或运行时从外网下载；所有依赖必须在**有网的构建机**上预先打入 `LAN-Exam-Setup.exe`，经 U 盘/内网文件共享拷入考场后离线安装 |

## 实施任务清单

- [x] **Phase A**：新增 `ADMIN_AUTH_MODE` / `LOCAL_ADMIN_USERNAME`；实现 admin-context、admin-guard、loopback 中间件；admin 路由统一 `resolveAdminTeacherId`
- [x] **Phase A**：`disabled` 模式下 `/api/admin/*` **与** `/api/auth/*` 均仅 loopback（或禁用 auth 路由）
- [x] **Phase A**：改造 `prisma/seed.ts` 与 entrypoint，disabled 模式种子 `local_exam_admin` 且不要求 `SEED_ADMIN_PASSWORD`（**不迁移**旧 `teacher_admin` 数据）
- [x] **Phase A**：Fastify 生产态托管 `web/dist`，统一监听 5180；开发态保持 vite+3101
- [x] **Phase A**：`VITE_ADMIN_AUTH_MODE=disabled` 时跳过登录路由与 AuthContext 校验；非 loopback 访问 `/admin` 时前端提示「请在本机打开」
- [x] **Phase B**：`fetch-runtimes.ps1` 离线物料（Node + Postgres + **vc_redist.x64.exe**）→ 全量打入 Setup；考场侧零外网
- [x] **Phase B**：`scripts/windows` 构建链 + Inno Setup + 托盘宿主 + 便携 Postgres/Node；安装时**本地静默**装 VC++；安装后自动防火墙规则
- [x] **Phase B**：`DEPLOY-WINDOWS-NATIVE.md`、更新 `DEPLOY.md`/`README`，按验收表做双机测试（文档与脚本已交付；双机验收需在真机执行）

---

## 1. 需求定义（已对齐）

| 项 | 约定 |
| --- | --- |
| 管理台 | `http://127.0.0.1:5180/admin`，**不验证考官身份**，无登录/改密页 |
| 学员端 | `http://<本机局域网IP>:5180/exam/*`，**保留**名单登录（姓名 + 身份证号） |
| 拓扑 | **单机**：管理机 = 服务器；学员机只访问 LAN IP，不访问管理台 |
| 交付 | **Inno Setup `.exe` 一键安装** + 桌面快捷方式 + 托盘常驻；免 Docker |
| 考官端范围 | **仅安装机本机**（`127.0.0.1`）；考试机只能访问学员路径与学员 API |
| 安全补偿 | 取消账号密码后，用 **本机 loopback（含 `/api/auth/*`）+ 防火墙仅放行 5180 学员流量 + 机房物理隔离** 替代身份校验 |
| 历史数据 | 切换免登录后 **不迁移**；旧考官账号下数据不对 `local_exam_admin` 可见 |
| **网络** | 考场为 **隔离局域网**，管理机/考试机 **均不能上外网**；仅管理机对 LAN 开放 5180 |

```mermaid
flowchart TB
  subgraph teacherPC [管理机_兼服务器]
    Setup[LAN-Exam-Setup.exe]
    Tray[托盘宿主]
    PG[(便携_Postgres_5434)]
    App[Node_Fastify_5180]
    AdminBrowser["浏览器_127.0.0.1:5180/admin"]
    Setup --> Tray
    Tray --> PG
    Tray --> App
    App --> PG
    AdminBrowser --> App
  end
  subgraph studentPCs [学员机_局域网]
    StudentBrowser["浏览器_LAN_IP:5180/exam"]
  end
  StudentBrowser -->|"仅 /api/student 等"| App
  AdminBrowser -->|"免登录 + /api/admin与/api/auth 仅 loopback"| App
```

---

## 1.1 离线部署模型（考场不能访问微软官网）

考场环境与构建环境**严格分离**：

```mermaid
flowchart LR
  subgraph online [有网环境_仅实施方或开发机]
    Build[pnpm build]
    Fetch[fetch-runtimes.ps1]
    Pkg[package.ps1 + Inno Setup]
    Build --> Fetch
    Fetch --> Pkg
    Pkg --> Artifact[LAN-Exam-Setup.exe<br/>内含全部离线物料]
  end
  subgraph offline [隔离局域网_考场]
    USB[U盘或内网共享]
    Install[LAN-Exam-Setup.exe]
    Mgmt[管理机]
    Exam[考试机浏览器]
    Artifact --> USB --> Install --> Mgmt
    Mgmt --> Exam
  end
```

| 阶段 | 是否允许访问外网 | 做什么 |
| --- | --- | --- |
| **构建/发版**（开发机或 CI） | **可以** | 下载 Node zip、Postgres 便携包、**`vc_redist.x64.exe`**，编译应用，打成 **单一离线安装包** |
| **考场安装与运行** | **不可以** | 只运行已拷贝进来的 `LAN-Exam-Setup.exe`；**不得** `curl` 微软、**不得** `winget`、**不得** 安装程序内嵌「在线下载」逻辑 |

**`LAN-Exam-Setup.exe` 必须自包含**（至少包括）：

- `runtime/node/`（Windows x64 官方 zip 解压）
- `runtime/postgres/`（PostgreSQL 16 Windows 便携二进制）
- `runtime/vcredist/vc_redist.x64.exe`（VC++ 2015–2022 x64 可再发行组件，**微软允许随产品分发**）
- `app/`（server + web dist + prisma migrations）
- `LAN-Exam-Tray.exe`、安装脚本

考场 **新装 Windows** 的使用方式：U 盘复制安装包 → 双击 Setup → **全部从本地解压/静默安装** → 无需也无法访问微软官网。

---

## 2. 现状与差距

### 2.1 已有能力

- 管理功能完整：题库/名单/考试 CRUD 与生命周期（`apps/server/src/routes/api/admin/`）
- 学员认证独立：`apps/server/src/plugins/student-guard.ts`
- 开发态 Web：`5180` + Vite 代理 `/api` → `3101`（`apps/web/vite.config.ts`）

### 2.2 关键差距

1. **考官强制登录**：前后端双层拦截（`admin-guard.ts`、`AdminRoute.tsx`）
2. **生产无 5180 Web**：`Dockerfile` 构建了 web 但未拷贝 `dist`，`index.ts` 未托管静态资源
3. **数据模型依赖 `teacherId`**：`QuestionImportBatch` / `RosterImportBatch` / `Exam` 等 FK 指向 `Teacher`（`prisma/schema.prisma`），不能完全去掉 Teacher 实体
4. **种子依赖密码**：`scripts/docker-entrypoint.sh`、`prisma/seed.ts` 强制 `SEED_ADMIN_PASSWORD`
5. **无 Windows 原生安装物**：仅有 Docker Compose（与甲方「免 Docker 一键」不符）

---

## 3. 目标架构

### 3.1 运行时（生产）

**单 Node 进程、单对外端口 `5180`（`0.0.0.0`）**：

- `GET /health` — 健康检查
- `/api/*` — 现有 API（含 `/api/admin/*`、`/api/student/*`、`/api/auth/*`）
- 其余路径 — `apps/web/dist` 静态 SPA + `index.html` fallback（React Router）

开发环境**保持现状**：`pnpm dev` = API `3101` + Vite `5180` 代理，避免影响日常开发。

### 3.2 环境变量（新增）

写入 `.env.example` 与安装包内置 `.env`：

```env
# 机房生产默认
ADMIN_AUTH_MODE=disabled          # disabled | session（开发可 session）
LOCAL_ADMIN_USERNAME=local_exam_admin
LISTEN_HOST=0.0.0.0
WEB_PORT=5180
DATABASE_URL=postgresql://lan_exam:lan_exam@127.0.0.1:5434/lan_exam
SESSION_SECRET=<安装时随机生成>
# ADMIN_AUTH_MODE=session 时才需要
SEED_ADMIN_PASSWORD=
```

| 变量 | 作用 |
| --- | --- |
| `ADMIN_AUTH_MODE=disabled` | 考官免登录；跳过 session 校验 |
| `LOCAL_ADMIN_USERNAME` | 免登录模式下写入题库/名单/考试的固定 `teacherId` |
| `LISTEN_HOST` / `WEB_PORT` | 生产统一监听 |
| `ADMIN_API_LOOPBACK_ONLY=true`（默认 true，机房包不可关） | `/api/admin/*` 与 `disabled` 模式下 `/api/auth/*` 仅允许 `127.0.0.1` / `::1` |

前端构建注入（Vite）：

```env
VITE_ADMIN_AUTH_MODE=disabled
```

---

## 4. 功能设计

### 4.1 后端：免登录 + 固定本地考官

**核心思路**：不删 Teacher 表；免登录时用**内置本地考官**满足 FK 与 `teacherId` 过滤。

1. **扩展 `prisma/seed.ts`**
   - `disabled` 模式：upsert `LOCAL_ADMIN_USERNAME`，`mustChangePassword=false`，`passwordHash` 为随机不可用工 hash（永不用于登录）
   - `session` 模式：保留现有 `teacher_admin` + `SEED_ADMIN_PASSWORD` 逻辑（供开发/可选回退）

2. **新增 `apps/server/src/lib/admin-context.ts`**
   - `isAdminAuthDisabled(): boolean`
   - `getLocalAdminTeacherId(): Promise<string>`（内存缓存）
   - `resolveAdminTeacherId(request): Promise<string>` — disabled 时返回本地考官 ID；session 时返回 session

3. **改造 `apps/server/src/plugins/admin-guard.ts`**
   - `disabled`：`requireAdminSession` 直接 return（或仅做 loopback 检查）
   - `session`：保持现有逻辑

4. **新增 loopback 中间件 `apps/server/src/plugins/admin-loopback-guard.ts`**
   - 对 `/api/admin/*`：若 `ADMIN_API_LOOPBACK_ONLY` 且客户端 IP 非 loopback → `403`
   - `ADMIN_AUTH_MODE=disabled` 时，对 `/api/auth/*`（login / logout / me / change-password）**同样仅 loopback**，防止考试机绕开管理 API 建立考官 session
   - 防止考试机访问 `http://<管理机IP>:5180` 时通过 DevTools 调用考官管理接口

5. **批量替换 admin 路由中的 `getSessionTeacherId(request)!`**
   - 约 10 个文件（`exams-crud`、`questions-import` 等）改为 `await resolveAdminTeacherId(request)`
   - `apps/server/src/lib/exam/transition.ts` 中 `exam.teacherId !== teacherId` 在单机单考官场景下自然成立

6. **生产静态托管（`apps/server/src/index.ts`）**
   - 增加 `@fastify/static` + SPA fallback 插件（仅 `NODE_ENV=production` 或 `SERVE_WEB=true`）
   - 生产只监听 `WEB_PORT`；开发仍监听 `API_PORT`

### 4.2 前端：去掉考官登录流

| 文件 | 改动 |
| --- | --- |
| `AuthContext.tsx` | `VITE_ADMIN_AUTH_MODE=disabled` 时：不调 `authApi.me()`，状态固定 `authenticated`，无 session 过期跳转 |
| `AdminRoute.tsx` | disabled 时直接 `<Outlet />` |
| `router.tsx` | disabled 时移除 `login` / `change-password` 路由；`/admin` 直达 `AdminLayout` |
| `AdminLayout.tsx` | 去掉用户名与「退出登录」；标题显示「考试管理台」 |
| `api.ts` | disabled 时 `handleAuthResponse` 对 admin 请求不弹「请重新登录」 |
| `AdminRoute` 或布局入口 | 当 `location.hostname` 非 `localhost` / `127.0.0.1` 时展示「请在本机打开」管理台提示，不渲染管理功能 |

登录相关页面（`AdminLogin.tsx` 等）**保留代码**但生产构建不挂路由，便于将来 `session` 模式回退。

### 4.3 学员端

**不改动业务逻辑**。确保生产 SPA 在 `0.0.0.0:5180` 可被局域网访问 `/exam/login`；学员 API 仍走 `student-guard`。

---

## 5. Windows 原生一键部署（免 Docker）

### 5.1 安装包形态与目录结构

**对外交付（必选项）**：`LAN-Exam-Setup.exe`（Inno Setup）

- 安装向导：选择目录（默认 `D:\LAN-Exam`）、写入 `.env`、初始化数据库、添加防火墙规则、创建开始菜单与**桌面快捷方式**
- 快捷方式「局域网考试系统」→ 启动**托盘宿主**（若服务未运行则拉起 Postgres + Node）并打开 `http://127.0.0.1:5180/admin`
- 安装完成后可选立即启动托盘

**安装后目录**（与绿色包布局一致，便于升级）：

```
lan-exam-win/
├── LAN-Exam-Tray.exe    # 托盘宿主（关闭窗口最小化，托盘「退出」才停服务）
├── install.bat          # Setup 内部调用 / 幂等修复
├── start.bat            # 启动 PG + Node（供 Tray 调用）
├── stop.bat             # 停止 PG + Node（供 Tray「退出」调用）
├── open-admin.bat       # 打开 http://127.0.0.1:5180/admin
├── runtime/
│   ├── node/            # Node 22 Windows x64 官方 zip（构建机预下载）
│   ├── postgres/        # PostgreSQL 16 Windows binaries（便携，构建机预下载）
│   └── vcredist/
│       └── vc_redist.x64.exe   # VC++ 2015–2022 x64（构建机预下载，考场离线静默安装）
├── app/
│   ├── server/dist/     # 编译后 API + 静态托管逻辑
│   ├── web/dist/        # Vite 构建产物
│   └── prisma/          # schema + migrations
├── data/                # PG 数据目录（安装后生成，升级保留）
├── logs/
└── .env                 # 安装时生成（含随机 SESSION_SECRET）
```

### 5.2 安装与托盘流程

```mermaid
sequenceDiagram
  participant U as 考官
  participant S as LAN-Exam-Setup.exe
  participant T as LAN-Exam-Tray.exe
  participant PG as 便携Postgres
  participant N as Node服务
  participant B as 浏览器
  U->>S: 运行安装程序
  S->>S: 本地静默安装捆绑的VC++_端口检测_写.env_防火墙5180
  alt 首次安装
    S->>PG: initdb + 创建库用户
    S->>N: prisma migrate deploy + seed local_exam_admin
  end
  S->>T: 创建桌面快捷方式并启动托盘
  T->>PG: 启动_pg_5434
  T->>N: 启动_Fastify_5180
  T->>T: 等待_/health_200
  T->>B: 打开_127.0.0.1:5180/admin
  Note over T: 用户点关闭 → 最小化到托盘_服务不停
  Note over T: 托盘选退出 → stop.bat_结束进程
```

**`LAN-Exam-Setup.exe`（Inno Setup）职责**：

1. 解压/安装到 `LAN_EXAM_HOME`，生成 `.env`（含随机 `SESSION_SECRET`）
2. **离线静默安装 VC++**：运行 `{app}\runtime\vcredist\vc_redist.x64.exe /install /quiet /norestart`（安装包内已捆绑，**不访问外网**；已安装则快速成功，幂等）
3. 若 `data/pg` 不存在 → `initdb`，创建 `lan_exam` 库与用户
4. `prisma migrate deploy` + seed（`local_exam_admin`，**不处理**旧 `teacher_admin` 数据）
5. **防火墙**：`netsh advfirewall` 添加入站规则「LAN Exam TCP 5180」，配置文件 **专用**，允许同一局域网考试机访问学员端
6. 创建桌面与开始菜单快捷方式；启动托盘宿主

**托盘宿主 `LAN-Exam-Tray.exe` 职责**（可用轻量 .NET / Go / Node 打包，本期纳入 Phase B）：

1. 启动时调用 `start.bat`（若 health 未就绪）
2. 托盘图标菜单：**打开管理台**、**复制学员地址**（`http://<LAN_IP>:5180/exam/login`）、**退出系统**
3. 主窗口关闭按钮 → **最小化到托盘**，不调用 `stop.bat`
4. 「退出系统」→ 调用 `stop.bat`，结束 Postgres 与 Node 后退出托盘进程

**`install.bat`**：供 Setup 与运维幂等调用（检测端口、补 migrate、修复 `.env`），不要求考官手动双击。

### 5.3 构建流水线（新增脚本，不提交巨型二进制）

新增 `scripts/windows/`：

| 脚本 | 作用 |
| --- | --- |
| `build-release.ps1` | `pnpm build` → 组装 `dist/lan-exam-win/app` |
| `fetch-runtimes.ps1` | **仅在有网构建机执行**：下载 Node、Postgres、**`vc_redist.x64.exe`** 到 `runtime/`（考场永不执行此脚本） |
| `package.ps1` | 组装绿色目录并调用 Inno Setup 生成 **`LAN-Exam-Setup.exe`（必出）** |
| `build-tray.ps1` | 编译 `LAN-Exam-Tray.exe` |

**发布物（验收必选）**：`LAN-Exam-Setup.exe`（含桌面快捷方式）。  
**可选附带**：`LAN-Exam-win-x64.zip`（与安装目录同结构，供 U 盘备份）。

Git **不提交** `runtime/node`、`runtime/postgres`、`runtime/vcredist` 二进制；**有网**的 CI/发布机运行 `fetch-runtimes.ps1` 后打完整离线包。  
发布检查：在**断网**虚拟机上仅拷贝 `LAN-Exam-Setup.exe` 安装，不得出现任何外网请求（可用防火墙日志或安装日志佐证）。

### 5.4 防火墙与端口

- 安装时**自动**入站放行 **TCP 5180**（**专用**网络配置文件），使同一局域网的**考试机**可访问 `http://<管理机IP>:5180/exam/*`
- 规则添加失败时：**警告并写入日志**，文档说明手动 `wf.msc` 步骤（是否阻断安装：默认**警告后继续**，由考官确认防火墙已开）
- **不**暴露 5434；Postgres 仅 `127.0.0.1`
- 考官管理台不依赖独立端口：仅 `127.0.0.1` 使用；`/api/admin/*` 与 `disabled` 下 `/api/auth/*` 仅 loopback

### 5.5 升级与数据

- `data/` 与 `logs/` 与 `app/` 分离；升级只替换 `app/` + `runtime/`（保留 `data/`）
- `install.bat` 检测已有 `data/pg` 则跳过 `initdb`，仅 `migrate deploy`

---

## 6. 开发/验收环境兼容

| 场景 | 方式 |
| --- | --- |
| 日常开发 | 继续 `pnpm db:up`（Docker 仅 DB）+ `pnpm dev`；`.env` 设 `ADMIN_AUTH_MODE=disabled` 验证免登录 |
| Docker 全栈 | 保留 `docker-compose.yml` 作可选；同步支持 `ADMIN_AUTH_MODE`、5180 映射、静态托管（优先级低于原生交付） |
| 认证回退 | `ADMIN_AUTH_MODE=session` + `SEED_ADMIN_PASSWORD` 恢复登录流（不删代码） |

---

## 7. 文档交付

更新/新增：

- `docs/DEPLOY.md` — 增加「Windows 原生一键」章节，Docker 降为可选
- 新增 `docs/DEPLOY-WINDOWS-NATIVE.md` — **离线发版与 U 盘进场**、考前 5 分钟操作清单、防火墙、学员 URL、故障排查（**不写「去微软官网下载」作为考场步骤**）
- `README.md` — 机房默认入口改为原生安装说明

**考前操作清单（摘要）**：

0. **发版侧（有网，考前完成）**：构建机执行 `fetch-runtimes.ps1` + `package.ps1`，将 `LAN-Exam-Setup.exe` 拷入 U 盘（可校验 SHA256）
1. **考场（无外网）**：U 盘拷贝到管理机，运行 `LAN-Exam-Setup.exe`，按向导完成安装（默认 `D:\LAN-Exam`）
2. 双击桌面「局域网考试系统」→ 托盘启动服务 → 浏览器打开本机管理台
3. 导入题库/名单 → 创建并开考（**重新导入**，勿依赖旧 Docker 环境下的 `teacher_admin` 数据）
4. 托盘「复制学员地址」或白板告知考试机：`http://<管理机IP>:5180/exam/login`
5. 考后：托盘「退出系统」停止服务；若下一场接着用，可仅最小化托盘不关服务

---

## 8. 安全说明（写入交付文档）

- 免登录前提：**管理 API 与 `/api/auth/*` 仅本机 loopback**；考试机无法建立考官 session 或调用管理接口
- 学员仍须名单验证；考试机在 LAN IP 上打开 `/admin` 仅见提示页，**无法操作**（API 403 + 前端拦截）
- 防火墙仅开放 5180 给局域网学员流量；考官操作始终通过 `127.0.0.1`
- HTTP 明文限于机房内网；公网暴露禁止
- 物理安全：无人看管考官机等同开放管理权限

---

## 9. 验收标准

| # | 验收项 | 期望 |
| --- | --- | --- |
| 1 | 全新 Windows 10/11 x64，无 Docker，**安装过程断网** | 仅 U 盘中的 `LAN-Exam-Setup.exe` 安装后 3 分钟内，桌面快捷方式打开管理台 |
| 1c | 离线物料 | 安装包内已含 Node/Postgres/VC++；考场机器**无需**访问微软或任何外网 |
| 1b | 桌面与托盘 | 存在桌面快捷方式；关闭窗口后托盘仍在，服务可用；托盘「退出」后服务停止 |
| 2 | 管理台 | `http://127.0.0.1:5180/admin` 无登录页，直达仪表盘 |
| 3 | 管理功能 | 题库导入、名单导入、创建考试、开考/收卷、导出正常 |
| 4 | API 隔离 | 从另一台 LAN 机器 `curl http://<IP>:5180/api/admin/ping` 返回 **403** |
| 5 | 学员端 | 另一台机器 `http://<IP>:5180/exam/login` 可登录并考试 |
| 6 | 重启 | 托盘退出 → 再次从快捷方式启动后数据仍在，无需重新导入 |
| 6b | 防火墙 | 考试机可访问 `http://<管理机IP>:5180/exam/login`（安装时已加 5180 入站规则） |
| 7 | 开发回退 | `ADMIN_AUTH_MODE=session` 时登录流仍可用 |

---

## 10. 实施分期与工作量（估算）

### Phase A — 核心能力（2–3 天）

- 环境变量 + `admin-context` + `admin-guard` + loopback 中间件
- admin 路由 `teacherId` 统一解析
- seed 本地考官；entrypoint/seed 条件化
- 生产静态托管 + 统一 `5180` 监听
- 前端免登录开关

### Phase B — Windows 原生打包（4–6 天）

- `scripts/windows/*` 构建、`LAN-Exam-Tray.exe`、**Inno Setup `LAN-Exam-Setup.exe`**
- 桌面/开始菜单快捷方式；安装时自动防火墙 5180 规则
- 便携 Postgres 初始化；托盘最小化/退出语义
- 文档 + 真机验收（管理机 + 1 台考试机）

### Phase C — 可选增强（后续）

- 开机自启（托盘或计划任务）
- Windows Service（NSSM）替代脚本拉起（若托盘方案不够用）
- 考后一键备份 `data/` 到 U 盘；安装包代码签名

**不纳入本期**：SQLite 迁移、多考官 RBAC、HTTPS、云端更新。

---

## 11. 主要改动文件清单

**后端**：`admin-guard.ts`、`index.ts`、`env.ts`、`seed.ts`、各 `apps/server/src/routes/api/admin/*.ts`

**前端**：`AuthContext.tsx`、`AdminRoute.tsx`、`router.tsx`、`AdminLayout.tsx`

**部署**：新增 `scripts/windows/`、`LAN-Exam-Tray`、`inno-setup/LAN-Exam.iss`、`.env.example`、`docs/DEPLOY-WINDOWS-NATIVE.md`；`Dockerfile` / `docker-compose.yml` 作次要同步

---

## 12. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 便携 Postgres/Node 缺 VC 运行库 | 安装包**捆绑** `vc_redist.x64.exe` 并**本地静默安装**（考场无外网，**禁止**引导上微软官网下载） |
| 考场无法访问外网 | 所有二进制与 VC++ 在**有网构建机**打入 Setup；文档区分「发版机构」与「考场现场」步骤 |
| 端口 5180/5434 被占用 | `install.bat` 检测并提示修改 `.env` |
| 杀毒软件误报便携二进制 | 代码签名（后续）或提供白名单说明 |
| 学员机访问 `/admin` 页面 | API loopback 403 + 前端非本机 hostname 提示 |
| `teacherId` 过滤导致旧数据不可见 | **已确认不迁移**；文档注明需重新导入；仅 `local_exam_admin` 下数据可见 |
| 关闭安装窗口误停服务 | 托盘宿主：关窗仅最小化，仅托盘「退出」停服 |
| 防火墙规则未生效 | 安装时自动添加 + 文档手动步骤；考试机连不通时优先排查专用网络配置文件 |

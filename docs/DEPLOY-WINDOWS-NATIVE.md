# Windows 原生一键部署（离线考场）

本文档面向**考场管理机**与**发版构建机**，与 Docker 部署并列。考场为**隔离局域网**，安装与运行过程**不得访问互联网**。

## 角色分工

| 环境 | 是否联网 | 操作 |
| --- | --- | --- |
| **发版机构 / 开发机** | 可以 | `fetch-runtimes.ps1` 下载 Node、PostgreSQL、VC++ → `package.ps1` 生成 `LAN-Exam-Setup.exe` |
| **考场管理机** | 不可以 | U 盘拷贝安装包 → 双击 Setup → 桌面快捷方式打开管理台 |

安装包**自包含**：Node、PostgreSQL 便携版、`vc_redist.x64.exe`、应用与迁移脚本。考场**禁止**引导考官访问微软官网或在线下载。

## 发版构建（有网，考前完成）

在仓库根目录（Windows x64，已安装 Node 20+、pnpm 9+、.NET 8 SDK、Inno Setup 6）：

```powershell
cd E:\programs\LAN_exam
.\scripts\windows\package.ps1
```

产出：

- `dist\LAN-Exam-Setup.exe`（验收必选）
- `dist\lan-exam-win\`（绿色目录，可备份）

可选仅组装应用（不下载运行时）：

```powershell
.\scripts\windows\build-release.ps1
```

## 考场安装（无外网）

1. 将 `LAN-Exam-Setup.exe` 拷入 U 盘，复制到管理机（默认安装路径 `D:\LAN-Exam`）。
2. 双击安装程序；向导会：
   - 本地静默安装捆绑的 VC++ 运行库
   - 生成 `.env`（含随机 `SESSION_SECRET`）
   - 初始化 Postgres（`data\pg`，端口 **5434** 仅本机）
   - 执行 `prisma migrate deploy` 与种子账号 `local_exam_admin`
   - 添加入站防火墙规则 **TCP 5180**（专用/Private 配置文件）
3. 安装结束勾选「启动」或双击桌面 **「局域网考试系统」**。
4. 浏览器打开 `http://127.0.0.1:5180/admin`（免登录管理台）。

## 考前 5 分钟清单

1. 桌面快捷方式启动托盘 → 等待 `/health` 就绪。
2. **重新导入**题库与名单（切换免登录后旧 `teacher_admin` 数据**不可见**；从 Docker Compose 或旧 session 环境升级时同样需重新导入，不做自动迁移）。
3. 创建考试并开考。
4. 托盘菜单 **「复制学员地址」** 或白板告知：`http://<管理机局域网IP>:5180/exam/login`
5. 考后：托盘 **「退出系统」** 停止服务；下一场可保持托盘运行。

## 网络与安全

- **管理台**：仅 `http://127.0.0.1:5180/admin`；`/api/admin/*` 与 `/api/auth/*` 仅 loopback，考试机调用返回 **403**。
- **学员端**：`http://<管理机IP>:5180/exam/*`，需名单登录。
- 考试机访问 `/admin` 仅见前端提示「请在本机打开」，无法操作管理功能。
- Postgres **5434** 不暴露局域网；仅 **5180** 对 LAN 开放学员流量。
- HTTP 限于机房内网；勿暴露公网。无人看管管理机等同开放管理权限。

## 目录结构（安装后）

```
D:\LAN-Exam\
├── LAN-Exam-Tray.exe
├── start.bat / stop.bat / install.bat / open-admin.bat
├── runtime\   (node, postgres, vcredist)
├── app\       (server dist, web dist, prisma)
├── data\pg\   (数据库，升级保留)
├── logs\
└── .env
```

关闭托盘窗口 → **最小化到托盘**，服务继续；仅托盘 **「退出系统」** 调用 `stop.bat`。

## 故障排查

| 现象 | 排查 |
| --- | --- |
| 管理台打不开 | 托盘是否运行；`logs\app.log`；本机 `curl http://127.0.0.1:5180/health` |
| 考试机无法打开学员页 | 防火墙专用网络是否启用；`wf.msc` 检查「LAN Exam TCP 5180」规则 |
| 考试机可打开 `/admin` | 正常：仅提示页；API 应 403 |
| 端口占用 | 修改 `.env` 中 `WEB_PORT` 并同步防火墙规则 |
| 导入后看不到旧数据 | 预期：仅 `local_exam_admin` 下数据可见，需重新导入 |

## 升级

替换 `app\` 与 `runtime\`（保留 `data\`、`logs\`、`.env`），再运行 `install.bat`（仅 migrate，不 initdb）。

## 开发机验证免登录

根目录 `.env`：

```env
ADMIN_AUTH_MODE=disabled
VITE_ADMIN_AUTH_MODE=disabled
```

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev
```

访问 `http://127.0.0.1:5180/admin` 应直达仪表盘。生产单进程：`NODE_ENV=production pnpm build` 后由 server 在 `5180` 托管静态资源。

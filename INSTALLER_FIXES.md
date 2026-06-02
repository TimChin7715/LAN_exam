# Windows 安装包修复记录

> 版本跨度：v1.6.6 → v1.6.26
> 涉及提交：`062890f` ~ 当前工作区

---

## 16. v1.6.26：学员未作答可确认交卷 + 防火墙公用网络放行

**发版产物**：`dist\LAN-Exam-Setup-v1.6.26.exe`

### 业务（学员交卷）

| 文件 | 变更 |
|---|---|
| `apps/web/src/lib/exam-submit-validation.ts` | `formatSubmitConfirmDescription`：有缺项时列出未作答题/操作题并问「是否仍要提交？」 |
| `apps/web/src/pages/StudentExamTake.tsx` | 手动交卷不再 toast 拦截；确认框动态文案；缺项时按钮「仍要提交」 |
| `apps/server/src/lib/exam/submit.ts` | 手动交卷不再 `requireComplete`；操作题统一 `finalizePracticalSubmissionIfDraft`（未上传也可交卷） |
| `AGENTS.md` | 学员流程说明更新 |

**行为**：手动点「提交试卷」时，即使有未作答客观/填空或未上传操作题，确认后仍可提交（未答按 0 分）；到点自动交卷逻辑不变。

### 安装 / 考场联网（针对历史问题）

| 文件 | 变更 |
|---|---|
| `inno-setup/LAN-Exam.iss` | 防火墙入站 **5180** 由仅 `profile=private` 改为 **`private,public,domain`**（教室网卡若为「公用」时学员机原先无法访问） |

**本包已含 v1.6.24–v1.6.25 安装修复**（勿跳过）：Postgres 等 180s、Prisma junction 可读检测、`postmaster.pid` 清理、`ensure-db-ready` 半安装恢复。

### 考场部署检查清单（安装后）

1. **管理员运行 Setup**；勿与 `install.bat` / 托盘同时跑 `install-db`。
2. `logs\install.log` 须含 **`install completed`**、`verify-install passed`；`/health` → `version":"1.6.26"`。
3. **考官本机**：`http://127.0.0.1:5180/admin`（`/admin` 禁止局域网访问，属设计）。
4. **学员机**：`http://<管理机局域网IP>:5180/exam/login`（托盘「复制学员地址」）；勿用 `/admin`。
5. 若学员机仍不通：本机 `curl http://127.0.0.1:5180/health`；`netstat` 见 `0.0.0.0:5180`；确认防火墙有 **LAN Exam TCP 5180**（v1.6.26 起含公用配置文件）。
6. 半安装 / Prisma 报错：管理员执行 `install.bat` 或 §15 现场修复命令。

### 自 v1.6.25 升级

覆盖安装或重装均可；若仅换业务未重装，开发机 `pnpm dev` / 绿色目录替换 `app\` 亦可，但考场推荐整包 **Setup v1.6.26**。

---

## 15. v1.6.25：Prisma junction 断裂 + pg_ctl 残留 pid

| 文件 | 变更 |
|---|---|
| `scripts/windows/templates/install-log.ps1` | `Test-InstallFileReadable`、`Resolve-PrismaCliPath`（优先 `.pnpm` 真实路径）、`Test-PrismaCliRunnable` |
| `scripts/windows/templates/install-db.ps1` | 迁移前修复链接并 **解析可读 Prisma 路径**；`Push-Location server-bundle`；`Remove-StalePostmasterPid`；`pg_ctl` 失败时写入 `postgres.log` tail |
| `scripts/windows/templates/verify-install.ps1` | 校验前 `repair-prisma-bundle-links` + Prisma **可执行**检测（不只 `Test-Path`） |
| `scripts/windows/templates/ensure-db-ready.ps1` | 非管理员时 WARN |

**现象（真机 v1.6.24 重装，`C:\LAN-Exam`）**：

1. Setup：`pg_ctl start exit=1` → 60s 内 Postgres 未就绪  
2. `start.bat`（**非管理员**）：Postgres 已起来，`CREATE ROLE/DATABASE` 成功  
3. `prisma migrate deploy`：`Cannot find module '...\node_modules\prisma\build\index.js'`（`Test-Path` 曾为 True）

**根因**：Inno 拷贝后 `node_modules\prisma` **junction 指向打包机路径或断裂**；`Test-Path` 对断链仍可能为 True，Node 无法加载。另：`postmaster.pid` 残留可导致 `pg_ctl` 秒退 exit=1。

**现场修复（v1.6.24 已装，不必等新版）** — **右键「以管理员身份运行」** `C:\LAN-Exam\install.bat`，或在管理员 PowerShell：

```powershell
cd C:\LAN-Exam
.\scripts\repair-prisma-bundle-links.ps1 -BundleDir "C:\LAN-Exam\app\server-bundle"
.\scripts\repair-pnpm-hoist-links.ps1 -BundleDir "C:\LAN-Exam\app\server-bundle"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\install-db.ps1" -InstallHome "C:\LAN-Exam" -InvokeSource manual
.\start.bat
```

成功标志：`logs\install.log` 含 `prisma CLI runnable`、`install completed`；浏览器 `http://127.0.0.1:5180/health` 返回 ok。

若 `repair-prisma` 报 Missing `@prisma+engines`：安装目录不完整，用 **v1.6.26** Setup 重装（勿只复制 logs 文件夹）。

---

## 14. v1.6.24：慢机 Postgres 就绪超时 + ensure-db-ready 半安装恢复

**发版产物**：`dist\LAN-Exam-Setup-v1.6.24.exe`（已被 v1.6.25 取代；含 v1.6.18–v1.6.23 累积修复）

### 安装脚本

| 文件 | 变更 |
|---|---|
| `VERSION` | 1.6.23 → **1.6.24** |
| `scripts/windows/templates/install-log.ps1` | 新增 `Invoke-NativeCliQuiet`（禁用 pwsh 7+ 原生命令终止错误）；`Test-PostgresIsReady`；`Wait-PostgresAccepting`；`Test-LanExamTeacherTable` |
| `scripts/windows/templates/install-db.ps1` | `Wait-PostgresReady` 默认 **180s**（原 90s）；`pg_ctl start` 使用 `Start-Process -Wait` + `-w`（与 v1.6.21 非阻塞版区分）；`Test-PostgresPortListening` / `Test-TeacherTable` 改用共享函数 |
| `scripts/windows/templates/verify-install.ps1` | 轻量库校验前 `Wait-PostgresAccepting` **60s**（替代单次 `pg_isready`，避免 install-db 超时后数秒才 ready 的竞态） |
| `scripts/windows/templates/ensure-db-ready.ps1` | 删除本地 `Test-TeacherTableExists`；改用 `Test-LanExamTeacherTable`；**无 Teacher 表时必定调用 `install-db`**（`lan_exam` 角色不存在不再 FATAL） |

### 行为说明

| 场景 | v1.6.23 | v1.6.24 |
|---|---|---|
| 慢机 `pg_ctl start` | 90s 超时即失败，可能未建 `lan_exam` | 最多等 **180s**；`pg_ctl` 自身 `-Wait` 结束后再轮询 |
| Setup「校验数据库」 | install-db 失败后 Postgres 晚几秒才 ready → 校验报未连接 | 最多再等 **60s**；仍缺 schema 则 `ensure-db-ready` → `install-db` |
| 半安装后 `start.bat` | `role "lan_exam" does not exist` 直接 FATAL | 视为未初始化，自动补跑 `install-db` |

### 真机案例（v1.6.23，`C:\LAN-Exam`，DESKTOP-0BAK1U2）

**现象**：Setup 界面走完，5180 不可用；无 `install completed` / `verify-install passed`。

**日志要点**：

| 时间 | 事件 |
|---|---|
| 03:15:37 | `pg_ctl start` |
| 03:17:11 | `[ERROR] Postgres did not become ready ... within 90s` |
| 03:17:20 | `postgres.log` 才 `ready to accept connections`（约 **103s**） |
| 03:17:23+ | `ensure-db-ready`：`role "lan_exam" does not exist` |

**根因**：

1. v1.6.21 非阻塞 `pg_ctl` + **90s** 轮询：慢磁盘/杀毒下启动超过 90s → `install-db` 在 `CREATE USER lan_exam` 前退出。
2. `ensure-db-ready` 用 `psql -U lan_exam` 探测表时，PowerShell 7+ 将「角色不存在」当 **FATAL**，未进入 `install-db` 修复分支。

### 验收（新装 / 重装 v1.6.24）

- `logs\install.log` 含：`Postgres ready on 127.0.0.1:5434`、`install completed`、`verify-install passed`
- `http://127.0.0.1:5180/health` → `{"status":"ok","version":"1.6.24"}`
- 管理台 `http://127.0.0.1:5180/admin` 可打开

### 现场修复（已装 v1.6.23、未重装）

管理员 PowerShell（安装目录示例 `C:\LAN-Exam`）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\LAN-Exam\scripts\install-db.ps1" -InstallHome "C:\LAN-Exam" -InvokeSource manual
```

成功后执行 `start.bat`。或改用 **v1.6.24** Setup 覆盖安装。

### 本版安装包另含（v1.6.18–v1.6.23，见下文 §8–§13）

- 移除 `@fastify/compress`（名单大 JSON 500）
- 到点自动交卷 + `deadline-scheduler` 须在 `listen` 前注册
- 统一 `install.log`、轻量 `verify-install`、`install-db` 文件锁
- 名单身份证号放宽（非空、≤32 字符）
- `start-node` 不重定向 stdout

---

## 13. v1.6.23：修复「校验数据库」长时间卡住 / 并发 install-db 互杀 Postgres

| 文件 | 变更 |
|---|---|
| `scripts/windows/templates/install-db.ps1` | 文件锁 `data\.install-db.lock`；Postgres 已就绪时跳过 `stop-postgres`；`/health` 已 OK 时跳过重启 Node |
| `scripts/windows/templates/verify-install.ps1` | **轻量校验**：`pg_isready` + `Teacher` 表；仅缺 schema 才调 `ensure-db-ready`；仅 `/health` 失败才 `start-node`（不再整包重跑 `install-db`） |
| `scripts/windows/templates/ensure-db-ready.ps1` | 有 `Teacher` 表即通过（无 marker 也写 marker） |
| `scripts/windows/templates/start-node.ps1` | 不再重定向 stdout（避免 pino 填满管道导致 Node 阻塞）；修复 `$entry` 变量遮蔽 |

**现象**：Setup 停在「正在校验数据库…」数分钟；或 v1.6.22 装完 5180 不可用。`install.log` 多次 `install-db` / `ensure-db-ready` 交错；`postgres.log` 反复「刚 ready 就 shutdown」。

**根因**：
1. `verify-install` 无条件调用 `ensure-db-ready` → 再跑完整 `install-db`（含 90s 等 Postgres）
2. 多个 `install-db` 并发（Setup + 托盘 + `install.bat`），各自 `stop-postgres` 互杀
3. `start-node` 重定向 stdout，Fastify/pino 日志可阻塞 Node 启动，导致 `install-db` 永不返回

**现场处理**：关闭安装程序窗口；勿同时跑 Setup / `install.bat` / 托盘；管理员 cmd 执行一次 `E:\LAN-Exam\start.bat`。

---

## 12. v1.6.22：放开名单身份证号限制 + 安装包同步

### 业务功能（名单 / 学员登录）

| 文件 | 变更 |
|---|---|
| `apps/server/src/lib/roster/types.ts` | `MAX_NATIONAL_ID_LENGTH = 32` |
| `apps/server/src/lib/roster/national-id.ts` | 新增 `validateRosterNationalId`（非空 + 最长 32，不再校验 18 位校验位） |
| `apps/server/src/lib/roster/validate-rows.ts` | Excel 导入改用宽松规则 |
| `apps/server/src/lib/roster/validate-entry.ts` | 管理台增改考生同上 |
| `apps/server/src/routes/api/student/verify.ts` | 学员登录 API 同上，`max(18)` → `max(32)` |
| `apps/web/src/pages/StudentLogin.tsx` | 去掉前端 18 位格式校验，Zod `max(32)` |
| `apps/server/src/lib/errors.ts` / `apps/web/src/lib/student.ts` | 错误文案改为「身份证号无效，请检查后重试」 |

**背景**：考场名单可能含工号、护照号、测试用短号等非标准 18 位身份证；旧逻辑在导入、增改、登录三处均调用 `isValidNationalIdFormat`，导致合法业务数据无法导入或无法登录。

**新规则**：trim 后非空、长度 ≤ 32；批次内「姓名 + 身份证号」唯一性不变；标准 18 位证号仍可用。

**测试**：`national-id.test.ts`、`validate-entry.test.ts`、`validate-rows.test.ts` 覆盖非标准证号通过及空/超长拒绝。

### 安装相关问题（v1.6.21 已修，本包内含）

| 现象 | 处理版本 |
|---|---|
| Setup「初始化数据库…」Cancel 灰色、长时间无响应 | v1.6.21：`pg_ctl` 非阻塞启动 |
| 库已就绪但 Node 秒退、5180 无服务 | v1.6.20：`deadline-scheduler` 须在 `listen()` 前注册 |
| 安装失败难排查 | v1.6.19+：`install.log` / `node-stdout.log` |

**v1.6.22 安装包** = 上述安装修复 + 名单证号放开；发版命令仍为 `scripts/windows/package.ps1` → `dist\LAN-Exam-Setup-v1.6.22.exe`。

---

## 11. v1.6.21：修复安装卡在「初始化数据库」（pg_ctl 阻塞）

| 文件 | 变更 |
|---|---|
| `scripts/windows/templates/install-db.ps1` | `pg_ctl start` 改用 `Start-Process`（不用 `2>&1` 管道）；`pg_isready` 判断已就绪则跳过；迁移前增加 STEP 日志 |

**问题**：Inno「初始化数据库…」界面 Cancel 灰色且 `install.log` 停在 `pg_ctl start`；`postgres.log` 已显示 ready，但 PowerShell `& pg_ctl ... 2>&1` 在 Windows 上可能永不返回。

**修复**：非阻塞启动 + `Wait-PostgresReady`；已监听则跳过 `pg_ctl`；repair/migrate 前写进度行便于判断未卡死。

---

## 10. v1.6.20：修复安装后 Node 立即退出（deadline-scheduler）

| 文件 | 变更 |
|---|---|
| `apps/server/src/index.ts` | `registerExamDeadlineScheduler` 须在 `app.listen()` **之前**调用 |

**问题**：v1.6.18 在 `listen()` 之后注册 `onClose` hook，Fastify 抛 `FST_ERR_INSTANCE_ALREADY_LISTENING`，进程 exit 1；`start-node` 仅重定向 stderr，错误 JSON 在 stdout，install.log 只见 “Node exited immediately”。

**修复**：将 scheduler 注册移到 `listen` 前；`start-node` 捕获 stdout → `node-stdout.log`；`install-db` 在 Node 启动失败时抛错，不再静默 `install completed`。

---

## 9. v1.6.19：安装日志增强

| 文件 | 变更 |
|---|---|
| `scripts/windows/templates/install-log.ps1` | 统一 install.log 格式与级别 |
| `write-env` / `verify-install` / `ensure-db-ready` / `start-node` | 安装全流程写入 install.log |
| `scripts/windows/templates/logs/README.txt` | 随包提供日志说明 |

**用途**：安装失败时按 `logs\install.log` 中 `[ERROR]`/`[FAIL]` 定位；校验仍要求含 `install completed`。

---

## 8. v1.6.18：名单列表 500 + 到点自动交卷

| 文件 | 变更 |
|---|---|
| `apps/server/package.json` | 移除 `@fastify/compress` |
| `apps/server/src/index.ts` | 不再注册 compress 插件 |
| `apps/server/src/lib/exam/*` | 到点自动交卷（deadline-scheduler、finalize-exam-submissions） |

**问题（名单导入后列表为空）**：Windows 离线 `server-bundle` 中 `@fastify/compress` 通过 `readable-stream@2` 调用 `Readable.from`，较大 JSON 响应（如名单列表）返回 500，前端显示 `Readable.from is not a function`；导入批次元数据正常但考生表 0 人。

**修复**：移除未使用的 `@fastify/compress`（机房内网 JSON 无需 gzip）。重新 `package.ps1` 打安装包后名单管理可正常加载。

**v1.6.18 功能**：到达 `scheduledEndAt` 自动批量交卷并结束考试；学员端倒计时；考官提前结束也会强制收卷。

---

## 1. Node 启动闪退修复（核心问题）

| 文件 | 变更 |
|---|---|
| `scripts/windows/templates/start-node.ps1` | 重写进程启动方式 |

**问题**：Node 进程安装后立即退出，原因为 `Start-Process` 在 `UseShellExecute` 默认值下不继承 `NODE_PATH` 环境变量，导致 Prisma 模块无法解析。

**修复**：
- 改用 `System.Diagnostics.ProcessStartInfo` + `UseShellExecute=$false`，手动复制当前进程环境变量
- `NODE_PATH` 设置为 `node_modules` 和 `.pnpm/node_modules` 双路径，解决 pnpm 严格模式下的模块解析
- 新增 `node-stderr.log`，Node 崩溃时自动捕获 stderr

**端口 5180 占用处理**：
- 不再简单跳过，先调用 `http://127.0.0.1:5180/health` 检查是否为本系统健康实例
- 如果是其他进程占用则强制终止

---

## 2. PostgreSQL 端口抢占问题

| 文件 | 变更 |
|---|---|
| `scripts/windows/templates/install-db.ps1` | 新增端口清理逻辑 |
| `scripts/windows/templates/stop-postgres.ps1` | 修复 pg_ctl 参数 |
| `scripts/windows/templates/stop.bat` | 修复 pg_ctl 参数 |

**问题**：已有 Docker 或其他服务占用 5434 端口时，`initdb` 或 `pg_ctl start` 静默失败。`stop.bat` 中 `pg_ctl stop fast` 参数语法错误（缺少 `-m`）。

**修复**：
- 新增 `Clear-InstallPorts` 函数：安装前主动释放 5180 和 5434 端口
- `Clear-PortForInstall`：45 秒超时轮询，bundled Postgres 用 `pg_ctl stop -m fast` 优雅停止，其他进程用 `Stop-Process` 强制终止
- `stop-postgres.ps1` / `stop.bat`：`stop fast` → `stop -m fast`

---

## 3. Prisma 离线安装修复

| 文件 | 变更 |
|---|---|
| `scripts/windows/build-release.ps1` | 构建时预置 Prisma CLI + 引擎预取 |
| `scripts/windows/verify-package.ps1` | 离线验证引擎在磁盘 |
| `scripts/windows/repair-prisma-bundle-links.ps1` | **新文件** |
| `scripts/windows/repair-pnpm-hoist-links.ps1` | **新文件** |

**问题**：`pnpm deploy` 生成的 server-bundle 中 `@prisma/engines` junction 链接断裂；安装时依赖 npm 下载 prisma/tsx，目标机无网络则失败。

**修复**：
- 移除 `install-db.ps1` 中的 `npm install prisma/tsx`，改为构建时预置
- `build-release.ps1` 中：
  - `pnpm exec prisma generate` 替代 `node prismaCli generate`
  - `pnpm dlx esbuild` 编译 seed.ts → seed.cjs
  - 新增 `prisma version` 预取步骤，确保 `schema-engine-windows.exe` 下载到 bundle
  - 自动移除 `server-bundle/data` 开发数据目录
- `repair-prisma-bundle-links.ps1`：修复 `@prisma+engines@*` 的 junction 链接
- `repair-pnpm-hoist-links.ps1`：修复 pnpm hoisted `node_modules` 下的模块链接
- `NODE_PATH` 双路径覆盖 `node_modules` + `.pnpm/node_modules`

---

## 4. 构建脚本可靠性

| 文件 | 变更 |
|---|---|
| `scripts/windows/build-release.ps1` | 删除重试 + 移除构建时 npm 依赖 |

**问题**：Node/IDE 持有 server-bundle 文件锁时 `Remove-Item` 直接报错退出。

**修复**：
- 新增 `Remove-DirForce` 函数：3 次重试 + 2 秒间隔 + `cmd /c rmdir /s /q` 最终兜底
- 所有 `Remove-Item -Recurse -Force` 替换为 `Remove-DirForce`

---

## 5. 安装流程增强

| 文件 | 变更 |
|---|---|
| `inno-setup/LAN-Exam.iss` | 新增校验步骤 + runascurrentuser |
| `scripts/windows/templates/install-db.ps1` | 幂等性 + 完成标记 |
| `scripts/windows/templates/install.bat` | 传递 InvokeSource |
| `scripts/windows/templates/start.bat` | 新增 ensure-db-ready |
| `scripts/windows/templates/ensure-db-ready.ps1` | **新文件** |
| `scripts/windows/templates/verify-install.ps1` | **新文件** |

**修复**：
- Inno Setup `[Run]` 段：write-env 和 install-db 添加 `runascurrentuser` flag，避免 SYSTEM 权限路径问题
- Inno Setup：install-db 传递 `-InvokeSource "inno-setup"` 参数
- Inno Setup：新增 `verify-install.ps1` 校验步骤
- `install-db.ps1`：
  - 检测 Teacher 表是否存在，已有数据库跳过 migrate deploy
  - 写入 `.install-db-complete` 标记文件
  - 安装成功后自动调用 `start-node.ps1` 启动服务
  - 失败时清除完成标记，允许重试
- `start.bat`：启动前先运行 `ensure-db-ready.ps1` 确认 PostgreSQL 就绪
- `install.bat`：传递 `-InvokeSource "install.bat"` 参数

---

## 6. 打包流程改进

| 文件 | 变更 |
|---|---|
| `scripts/windows/package.ps1` | 阶段标注 + 前置验证 |
| `scripts/windows/validate-install-scripts.ps1` | **新文件** |
| `scripts/windows/package-in-terminal.ps1` | **新文件** |

**修复**：
- `package.ps1`：5 个阶段标注 `[1/5] build-release` ~ `[5/5] Inno Setup compress`，每阶段显示时间戳
- 打包前运行 `validate-install-scripts.ps1` 验证安装脚本完整性
- 新增 `package-in-terminal.ps1` 终端一键打包入口

---

## 7. 可观测性（安装日志）

| 文件 | 变更 |
|---|---|
| `scripts/windows/templates/install-log.ps1` | **新文件**：统一安装日志 API |
| `scripts/windows/templates/write-env.ps1` | 写入 install.log（版本、用户、.env 摘要） |
| `scripts/windows/templates/install-db.ps1` | 结构化 STEP/OK/FAIL/ERROR + 命令输出 |
| `scripts/windows/templates/verify-install.ps1` | 文件清单、.env 键、/health、失败时 tail |
| `scripts/windows/templates/ensure-db-ready.ps1` | 运行时补库路径日志 |
| `scripts/windows/templates/start-node.ps1` | 启动结果写入 install.log + app.log |
| `scripts/windows/templates/logs/README.txt` | **新文件**：日志文件说明（随包复制到 `logs/`） |

**install.log 行格式**：`[yyyy-MM-dd HH:mm:ss] [LEVEL] [script] message | key=value ...`

**LEVEL**：`INFO` / `WARN` / `ERROR` / `STEP` / `OK` / `FAIL`

**安装顺序（Inno）**：`write-env` → `install-db` → `verify-install`；成功时 install.log 须含 **`install completed`**。

**排查**：安装失败先看 `logs\install.log` 中 `[ERROR]`、`[FAIL]`、`FATAL`；数据库看 `initdb.log` / `postgres.log` / `seed.log`；服务起不来看 `node-stderr.log` 与 `app.log`。

**保留**：`debug-57b789.log`（NDJSON 内部诊断，一般可忽略）。

---

## 变更文件清单（v1.6.26 安装包）

### v1.6.26 本版增量

- `VERSION`
- `INSTALLER_FIXES.md`
- `inno-setup/LAN-Exam.iss`（防火墙 profile）
- `apps/web/src/lib/exam-submit-validation.ts`
- `apps/web/src/pages/StudentExamTake.tsx`
- `apps/server/src/lib/exam/submit.ts`
- `AGENTS.md`

### 安装包累积（v1.6.18–v1.6.26，打入同一 Setup）

**服务端 / 业务**

- `apps/server/package.json`（移除 `@fastify/compress`）
- `apps/server/src/index.ts`（deadline-scheduler 注册顺序）
- `apps/server/src/lib/exam/deadline-scheduler.ts`、`finalize-exam-submissions.ts`（新增）
- `apps/server/src/lib/exam/submit.ts`、`access.ts`、`transition.ts` 等（到点交卷）
- `apps/server/src/lib/roster/*`（证号 ≤32）
- `apps/server/src/routes/api/student/verify.ts`、`exam-submit.ts`、`exam-status.ts`
- `apps/web/src/pages/StudentExamTake.tsx`、`StudentLogin.tsx`
- `apps/web/src/lib/student.ts`、`exam-countdown.ts`（新增）

**Windows 安装 / 运行时**

- `inno-setup/LAN-Exam.iss`（`write-env` → `install-db` → `verify-install`）
- `scripts/windows/build-release.ps1`、`package.ps1`、`verify-package.ps1`
- `scripts/windows/templates/write-env.ps1`
- `scripts/windows/templates/install-db.ps1`
- `scripts/windows/templates/verify-install.ps1`
- `scripts/windows/templates/ensure-db-ready.ps1`
- `scripts/windows/templates/install-log.ps1`
- `scripts/windows/templates/start-node.ps1`
- `scripts/windows/templates/install.bat`、`start.bat`、`stop.bat`
- `scripts/windows/templates/stop-postgres.ps1`
- `scripts/windows/templates/logs/README.txt`
- `scripts/windows/repair-prisma-bundle-links.ps1`
- `scripts/windows/repair-pnpm-hoist-links.ps1`
- `scripts/windows/validate-install-scripts.ps1`
- `scripts/windows/cleanup-dist-artifacts.ps1`
- `docs/DEPLOY-WINDOWS-NATIVE.md`（日志排查说明）

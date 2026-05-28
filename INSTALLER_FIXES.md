# Windows 安装包修复记录

> 版本跨度：v1.6.6 → v1.6.15
> 涉及提交：`062890f` ~ 当前工作区

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

## 7. 可观测性

| 文件 | 变更 |
|---|---|
| `scripts/windows/templates/install-db.ps1` | NDJSON 调试日志 |
| `scripts/windows/templates/start-node.ps1` | NDJSON 调试日志 |

**新增**：
- `Write-DebugNdjson` 函数：记录结构化事件到 `logs/debug-57b789.log`
- 关键埋点：install-db 入口、role check、success/fatal、Node early exit
- `install.log` 增强：时间戳、用户名、管理员状态、调用来源

---

## 变更文件清单

### 修改的文件
- `VERSION`
- `inno-setup/LAN-Exam.iss`
- `scripts/windows/build-release.ps1`
- `scripts/windows/package.ps1`
- `scripts/windows/verify-package.ps1`
- `scripts/windows/templates/install-db.ps1`
- `scripts/windows/templates/install.bat`
- `scripts/windows/templates/start-node.ps1`
- `scripts/windows/templates/start.bat`
- `scripts/windows/templates/stop-postgres.ps1`
- `scripts/windows/templates/stop.bat`

### 新增的文件
- `scripts/windows/templates/ensure-db-ready.ps1`
- `scripts/windows/templates/verify-install.ps1`
- `scripts/windows/repair-prisma-bundle-links.ps1`
- `scripts/windows/repair-pnpm-hoist-links.ps1`
- `scripts/windows/validate-install-scripts.ps1`
- `scripts/windows/package-in-terminal.ps1`

# 项目知识库

## 环境

- 开发 Postgres 在 **5434**（`pnpm db:up`），不是默认 5432。
- `pnpm dev` 不启动数据库；忘记 `db:up` 时 migrate/API 会连不上。

## 代码陷阱

- **考官前后端认证不一致**：只改 `ADMIN_AUTH_MODE` 会导致前端仍走登录 UI。
- **管理 API 从学员机访问**：`/api/admin/*` 返回 403 是设计，不是 bug。
- **学员 session 与选考**：多场 `IN_PROGRESS` 时需先 `POST /api/student/exam/select` 写入 session `examId`，再查状态/拉卷。

## 部署路径勿混用

| 路径 | 对外端口 | 管理台 |
|------|----------|--------|
| Windows Setup / 默认 Compose | **5180** | 本机 `127.0.0.1:5180/admin` |
| Linux `deploy-docker.sh` | **8001** | SSH 隧道 → `127.0.0.1:5180/admin` |

Linux 联调学员 URL 用 `http://<IP>:8001/exam/login`，不是 5180。详见 [DEPLOY.md](DEPLOY.md)。

## 导入与上传

| 现象 | 排查 |
|------|------|
| 填空题导入失败 | 答题卡须 `.xls/.xlsx`；工作表名 **答题卡**；列「题号/答案/分值」 |
| 上传 `request file too large` | 查 `MULTIPART_MAX_FILE_BYTES` ≥ `MAX_PRACTICAL_*` / `MAX_FILLIN_SCREENSHOT_BYTES` |
| 导入后无旧数据 | 当前为 `local_exam_admin`；`teacher_admin` **不迁移** |

客观题多选：**全对才得分**（`ALL_OR_NOTHING`）。填空 Word 不要求与答题卡逐题一一对应。

## Docker

| 现象 | 排查 |
|------|------|
| `app` 容器启动即退出 | `docker compose logs app`；db 未 ready；session 模式缺 `SEED_ADMIN_PASSWORD` |
| LAN 学员无法 `/exam/login` | 防火墙/安全组放行 **5180**（或 Linux 测试的 **8001**） |
| 误暴露 Postgres | `5434` 应仅 `127.0.0.1` 绑定 |

## Windows 安装（考场）

**权威踩坑记录**：[../INSTALLER_FIXES.md](../INSTALLER_FIXES.md)（按版本 §1–§18；发版前必读 §14–§18）。操作手册全文：[../docs/DEPLOY-WINDOWS-NATIVE.md](../docs/DEPLOY-WINDOWS-NATIVE.md)。`doc/` 仅摘要，细节以 INSTALLER_FIXES 为准。

### INSTALLER_FIXES 章节速查（近期）

| § | 主题 | 典型现象 |
|---|------|----------|
| §14 | Postgres 慢启动 / 半安装 | `not ready within 90s`；Setup 走完但无 `install completed` |
| §15 | Prisma junction + stale pid | `Cannot find module ...\prisma\build\index.js`；`pg_ctl exit=1` |
| §16 | 防火墙 + 缺项确认交卷 | 学员机连不上 5180（公用网卡）；手动交卷须确认未作答题 |
| §17–§18 | 重打包 | 保持 §14–§16 修复不回退；`/health` version 与 `VERSION` 一致 |

### 现场速查表

| 现象 | Likely cause | 动作 |
|------|----------------|------|
| `prisma migrate` 找不到 `build/index.js` | `node_modules\prisma` junction 断裂；`Test-Path` 仍可能为 true | 管理员运行 `install.bat` 或 §15 `repair-prisma-bundle-links.ps1` |
| `pg_ctl start exit=1` | `postmaster.pid` 残留或慢机超时 | §14–15 清理 pid / 加长等待；看 `postgres.log` |
| 学员机无法访问 5180 | 网卡为「公用」配置文件未放行 | v1.6.26+ 防火墙规则含 `public`；检查规则 **LAN Exam TCP 5180** |
| 考官用 LAN IP 开 `/admin` | 仅允许 loopback | 本机用 `127.0.0.1:5180/admin`；学员用 `http://<LAN_IP>:5180/exam/login` |

安装成功标志：`logs\install.log` 含 `install completed`、`verify-install passed`；`/health` 的 `version` 与 `VERSION` 一致。

| 现象 | 排查 |
|------|------|
| 管理台打不开 | 托盘是否运行；`logs\app.log`；`curl http://127.0.0.1:5180/health` |
| 考试机打不开学员页 | 防火墙 5180（v1.6.26+ 含 public）；管理机 IP 是否变化 |
| 升级保留数据 | 替换 `app\`/`runtime\`，保留 `data\`、`logs\`、`.env`；`install.bat` 只 migrate 不 initdb |

## 验证命令速查

```bash
# 开发
pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev

# 单测（在 apps/server）
npx tsx --test src/lib/exam/resolve-student-exam-status.test.ts

# 健康
curl -sSf http://127.0.0.1:5180/health
```

## 外部依赖 quirks

- Prisma / pnpm 在 **Windows 离线拷贝** 后链接易断，发版脚本含 repair 步骤，现场勿只复制 `app\` 部分文件而不跑 `install.bat`。
- Docker 与 Windows 原生考场交付路径不同；要点见 [DEPLOY.md](DEPLOY.md)。
- Setup 离线模型：构建机可上网下载 Node/Postgres/VC++；考场 **禁止** 安装时访问外网（见 [../docs/PLAN-考官免登录一键部署.md](../docs/PLAN-考官免登录一键部署.md) §1.1）。

---

## 2026-06-03 — 发版与 INSTALLER_FIXES 接力

- **构建机**：`package.ps1` 前若 `node` 占用 `dist\lan-exam-win\app\server-bundle`，`build-release` 会报无法删除目录 — 结束相关 `node.exe` 后重跑。
- **现场**：安装界面走完 ≠ 服务可用；以 `logs\install.log` 的 `install completed` 与 `/health` 为准。
- **文档分工**：新踩坑写入 `INSTALLER_FIXES.md` 新版本节；`doc/KNOWLEDGE.md` 只补速查表与 § 索引，避免双处长篇漂移。

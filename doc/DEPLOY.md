# 部署与交付 — 索引与要点

> **完整手册**仍在 [../docs/](../docs/)。本文供 AI / 维护者快速选路径；考场操作细节以 [../docs/DEPLOY-WINDOWS-NATIVE.md](../docs/DEPLOY-WINDOWS-NATIVE.md) 为准。

## 文档地图

| 文档 | 场景 | 端口 |
|------|------|------|
| [DEPLOY-WINDOWS-NATIVE.md](../docs/DEPLOY-WINDOWS-NATIVE.md) | **考场推荐**：离线 Setup + 托盘 | 5180（LAN 学员）；5434 仅本机 |
| [DEPLOY-DOCKER.md](../docs/DEPLOY-DOCKER.md) | 开发机 / 验收一键 Compose | 5180 |
| [DEPLOY.md](../docs/DEPLOY.md) | Compose 运维、反代、上传限制、FAQ | 5180 |
| [DEPLOY-LINUX-TEST.md](../docs/DEPLOY-LINUX-TEST.md) | Linux 公网联调（**非考场交付**） | 宿主机 **8001** |
| [PLAN-考官免登录一键部署.md](../docs/PLAN-考官免登录一键部署.md) | Phase 验收、风险、决策档案 | — |
| [INSTALLER_FIXES.md](../INSTALLER_FIXES.md) | v1.6.x 安装包修复编年 | — |

## 三条部署路径

### 1. Windows 原生（考场交付）

| 阶段 | 联网 | 动作 |
|------|------|------|
| 发版机 | 可以 | 维护根目录 `VERSION` → `.\scripts\windows\package.ps1` → `dist\LAN-Exam-Setup-v<版本>.exe` |
| 考场管理机 | **不可以** | U 盘 Setup → 桌面快捷方式 → `127.0.0.1:5180/admin` |

Setup **自包含**：便携 Node、Postgres 16、VC++、`app/`（server+web dist+migrations）、托盘。安装时：`.env`（随机 `SESSION_SECRET`）、`prisma migrate deploy`、种子 `local_exam_admin`、防火墙 **TCP 5180**（v1.6.26+ 含 public profile）。

默认安装目录示例：`D:\LAN-Exam\`（`runtime\`、`app\`、`data\pg\`、`logs\`、`.env`）。

### 2. Docker Compose（开发 / 验收）

```bash
cp .env.docker.example .env   # 建议改 SESSION_SECRET
docker compose up -d --build
```

- 服务：`db`（postgres:16，宿主机 `127.0.0.1:5434`）+ `app`（5180 合一）
- 启动链：`migrate deploy` → `db seed` → Node
- 默认 `ADMIN_AUTH_MODE=disabled`，种子 `local_exam_admin`，**不需** `SEED_ADMIN_PASSWORD`
- 验收：`curl http://127.0.0.1:5180/health`；LAN 访问 `/api/admin/ping` 应 **403**

详见 [DEPLOY-DOCKER.md](../docs/DEPLOY-DOCKER.md)、运维 [DEPLOY.md](../docs/DEPLOY.md)。

### 3. Linux 公网测试（非考场）

- 脚本：`scripts/linux/deploy-docker.sh`；环境文件 **`.env.deploy`**（gitignore，不覆盖本机 `.env`）
- 叠加 `docker-compose.host-app.yml`（app `network_mode: host`）
- 对外 **8001**（`WEB_HOST_PORT`）；考官管理台经 **SSH 隧道** `5180:127.0.0.1:8001` 后访问 `127.0.0.1:5180/admin`
- 远程：`python scripts/linux/remote_ssh.py deploy|finish|diag`（需 `.deploy-ssh-password`）

## 角色与 URL（统一）

| 角色 | URL | 认证 |
|------|-----|------|
| 考官 | `http://127.0.0.1:5180/admin` | 默认免登录；仅 loopback |
| 学员 | `http://<管理机LAN_IP>:5180/exam/*` | 姓名 + 身份证号 |

- 考试机打开 `/admin`：前端提示「请在本机打开」；`/api/admin/*` → 403（设计行为）。
- Postgres **5434** 不对 LAN 开放。

## 考前 → 考中 → 考后（Windows / Compose 通用）

**考前**

1. `/health` 正常；导入客观题 / 填空题 / 操作题批次、名单（模板见仓库 `templates/`）。
2. 设置页：座位表开关、必要时「清除全部数据」。
3. 创建混合考试（模块 `OBJECTIVE` / `FILL` / `PRACTICAL` + 名单 + 起止时间）→ **开始考试**。

**考中**

- 学员登录；座位表（若开启）自动随机分配。
- 客观/填空自动保存 + 周期 sync；填空截图佐证（不参与计分）；操作题需上传 `.doc/.docx` 后交卷（手动交卷可缺项确认，到点自动交卷规则见 `AGENTS.md`）。
- 到点：deadline 自动收卷并 `ENDED`；考官「结束考试」会先强制未交卷学员 deadline 交卷。

**考后**

- 导出成绩 Excel（汇总 + 客观明细 + 填空明细）；填空截图 ZIP（仅已交卷）；操作题逐人下载。
- 下一场全新数据：设置 → 清除全部数据 → 重新导入。

## 导入格式速查

| 模块 | 文件 | 规则 |
|------|------|------|
| 客观题 | `.xls/.xlsx/.csv` | `templates/题库导入模板.xlsx`；多选计分 `ALL_OR_NOTHING` |
| 名单 | `.xls/.xlsx/.csv` | `templates/名单导入模板.xlsx`；列：姓名 / 单位 / 身份证号 |
| 填空题 | Word + 答题卡 Excel + 可选附件 | 工作表名 **答题卡**；列：题号 / 答案 / 分值；答案可用 `\|` 分隔 |
| 操作题 | Word + Excel/CSV 附件 | 不自动计分 |

切换免登录后 **不迁移** `teacher_admin` 数据；旧数据须重新导入到 `local_exam_admin`。

## 上传与存储

| 变量 | 默认 | 说明 |
|------|------|------|
| `DATA_DIR` | `data/` | 批次、答卷、`exam-work/{examId}/…` |
| `MAX_PRACTICAL_DOCX_BYTES` | 20MB | Word 试卷 / 操作题答卷 |
| `MAX_PRACTICAL_XLSX_BYTES` | 10MB | 操作题/填空附件 |
| `MAX_FILLIN_SCREENSHOT_BYTES` | 5MB | 填空截图单张；每空最多 5 张 |
| `MULTIPART_MAX_FILE_BYTES` | 取各类上限最大 | 小于实际上限时报 `request file too large` |

Compose 默认 `DATA_DIR=/app/data`；Windows 安装目录下 `data\`。

## 反向代理（可选，非考场默认）

应用仍监听 5180；Nginx/IIS 整站转发。设置 `TRUST_PROXY=true`。TLS 在代理层终止。勿将裸 HTTP 暴露公网。

## Phase 状态（来自 PLAN）

- **Phase A / B**：代码与 Windows 安装链 **已落地**（2026-05-20 方案）。
- **双机真机验收**：文档与脚本已交付，须在目标考场环境执行。
- **Phase C（可选，未承诺）**：考后自动备份等。

## 排障入口

| 环境 | 日志 / 检查 |
|------|-------------|
| Windows | `logs\app.log`、`logs\install.log`；`wf.msc` → LAN Exam TCP 5180 |
| Docker | `docker compose logs app` / `db` |
| 安装深层问题 | [INSTALLER_FIXES.md](../INSTALLER_FIXES.md) |

常见现象摘要见 [KNOWLEDGE.md](KNOWLEDGE.md)。

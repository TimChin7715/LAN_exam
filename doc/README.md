# 项目上下文 — 阅读指南

本目录（`doc/`）供 **AI 协作者与维护者跨会话接力**；与根目录 `README.md`（产品入口）、`AGENTS.md`（代码落点权威）、`docs/`（部署手册全文）分工不同。

## 新会话请先读（按顺序）

1. [STATE.md](STATE.md) — 当前在做什么、卡在哪
2. [continue.md](continue.md) — 上一轮停在哪、下一步做什么
3. 首次接触项目 → [VISION.md](VISION.md)、[ARCHITECTURE.md](ARCHITECTURE.md)、[SETUP.md](SETUP.md)
4. 涉及部署/考场 → [DEPLOY.md](DEPLOY.md)（`docs/` 要点索引）
5. 安装失败 / 学员机连不上 / Prisma 报错 → [../INSTALLER_FIXES.md](../INSTALLER_FIXES.md)（全文编年）；速查 [KNOWLEDGE.md](KNOWLEDGE.md) Windows 节

## 按需查阅

- [DECISIONS.md](DECISIONS.md) — 为什么这样设计
- [KNOWLEDGE.md](KNOWLEDGE.md) — 坑与环境 quirks
- [CONVENTIONS.md](CONVENTIONS.md) — 代码/测试/commit 约定
- [ENV.md](ENV.md) — 环境变量说明（值见 `.env.example`）

## 文档分轨

| 目录/文件 | 读者 | 内容 |
|-----------|------|------|
| **`doc/`**（本目录） | AI / 维护者接力 | 状态、决策摘要、部署要点、不重复全文 |
| **`docs/`** | 实施 / 运维 / 验收 | 部署手册、PLAN 决策档案（Markdown 全文） |
| **`AGENTS.md`** | AI / 后端维护者 | 认证、模块落点、安全假设 |
| **`INSTALLER_FIXES.md`** | Windows 发版 / 现场 | **考场踩坑与修复编年（权威）**；当前最新 Setup 见 `VERSION`（1.6.29） |
| 根 **`README.md`** | 新读者 | 能力列表、pnpm 开发入口 |

## `docs/` 全文索引

| 文档 | 用途 |
|------|------|
| [../docs/DEPLOY-WINDOWS-NATIVE.md](../docs/DEPLOY-WINDOWS-NATIVE.md) | 考场 U 盘安装、考前考后、目录结构、FAQ |
| [../docs/DEPLOY-DOCKER.md](../docs/DEPLOY-DOCKER.md) | Docker 快速上手、离线镜像 |
| [../docs/DEPLOY.md](../docs/DEPLOY.md) | Compose 运维、反代、上传限制、清除数据范围 |
| [../docs/DEPLOY-LINUX-TEST.md](../docs/DEPLOY-LINUX-TEST.md) | Linux 8001 公网联调、SSH 隧道管理台 |
| [../docs/PLAN-考官免登录一键部署.md](../docs/PLAN-考官免登录一键部署.md) | Phase 清单、验收表、离线模型、风险 |
| [../docs/考试系统业务和需求梳理5.18.docx](../docs/考试系统业务和需求梳理5.18.docx) | 早期业务梳理（Word，非运行时文档） |

## 更新规则

| 文件 | 何时更新 |
|------|----------|
| continue.md, STATE.md | 每轮有意义的对话结束 |
| DEPLOY.md | `docs/` 部署行为或路径变化时同步要点 |
| DECISIONS.md, KNOWLEDGE.md | 有新决策或新坑时追加 |
| VISION / ARCHITECTURE / CONVENTIONS | 方向或架构大改时 |

## 禁止

- 不写密钥、token、生产凭证
- 不粘贴完整对话记录
- 不在长期文档里堆文件路径行号（短期指针只放 continue.md）
- 不在 `doc/` 复制 `docs/` 全文（只保留摘要 + 链接，避免双处维护漂移）

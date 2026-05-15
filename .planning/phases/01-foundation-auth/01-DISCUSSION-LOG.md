# Phase 1: 基础服务与教师认证 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Decisions are captured in `01-CONTEXT.md`.

**Date:** 2026-05-15  
**Phase:** 1-基础服务与教师认证  
**Areas discussed:** 教师账号模型, 进程与部署形态  

---

## 教师账号模型（首期）

| Option | Description | Selected |
|--------|-------------|----------|
| A | 仅单个超级管理员 | |
| B | 多名教师，权限相同 | ✓ |
| C | 管理员 + 普通教师两级 | |

**User's choice:** B — 多名教师各自账号，权限平等。

| Option | Description | Selected |
|--------|-------------|----------|
| A | 首次访问安装向导创建管理员 | |
| B | 环境变量 / 配置文件注入初始凭据 | |
| C | 数据库迁移种子 + 首次登录强制改密 | ✓ |

**User's choice:** C

| Option | Description | Selected |
|--------|-------------|----------|
| A | v1 不做自助找回，文档说明机房处理 | ✓ |
| B | 多管理员互相重置（依赖多账号策略） | |
| C | 简易自助找回 | |

**User's choice:** A

| Option | Description | Selected |
|--------|-------------|----------|
| A | 服务端 Session + HttpOnly Cookie | ✓ |
| B | JWT 主会话 | |
| C | 未锁定，交给 plan-phase | |

**User's choice:** A  

**Notes:** 用户一次性给出题 1–4 答案；未进入「每区第四轮后再问是否继续」的交互循环，视为本区域已收敛。

---

## 进程与部署形态

| Option | Description | Selected |
|--------|-------------|----------|
| A | Docker Compose 作为标准交付 | ✓ |
| B | Windows 裸进程直接运行 | |
| C | 双路径都写文档 | |

**User's choice:** A

| Option | Description | Selected |
|--------|-------------|----------|
| A | `0.0.0.0` + 防火墙文档 | |
| B | 本机回环 + 反向代理 | |
| C | 不锁死，文档包含 A/B 两套验收 | ✓ |

**User's choice:** C

| Option | Description | Selected |
|--------|-------------|----------|
| A | 仅控制台日志 | |
| B | 控制台 + 文件日志 | |
| C | `/health` + 控制台日志 | ✓ |

**User's choice:** C

| Option | Description | Selected |
|--------|-------------|----------|
| A | 开发以 Docker 为主 | ✓ |
| B | 开发机任意 OS | |
| C | 强制与生产同 OS | |

**User's choice:** A  

**Notes:** 监听/代理组合不锁定，由部署文档覆盖两种验收路径。

---

## Claude's Discretion

- 无「你决定」类委托；Planner 对未讨论子项（HTTPS、路由前缀）保留合理默认提案权，见 `01-CONTEXT.md`。

## Deferred Ideas

- 灰区 1（内网 HTTPS 策略）未选题 — 见 CONTEXT `<deferred>`。
- 灰区 4（管理端路由结构）未选题 — 见 CONTEXT `<deferred>`。

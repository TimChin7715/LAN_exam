# 局域网考试系统（LAN Exam）

## What This Is

面向机房/教室场景的 **Web 局域网考试系统**：在专用服务器上运行 Fastify + React 服务，教师通过浏览器导入题库与名单、编排考试并导出成绩；学员通过浏览器以姓名+身份证强绑定身份完成考试。v1.0 形成「部署 → 题库 → 名单 → 考试 → 导出」完整闭环，不追求高级防作弊。

## Core Value

**在局域网内，学员能按名单强绑定身份完成考试，教师能可靠地导入题目与名单并导出成绩与答题明细。**

## Current State (v1.0 shipped 2026-05-17)

- **Stack:** pnpm monorepo — `@lan-exam/server` (Fastify 5, Prisma, PostgreSQL, express-session + connect-pg-simple), `@lan-exam/web` (Vite, React, shadcn)
- **Deploy:** Docker Compose 优先；`docs/DEPLOY.md` 双路径（直连 / 反向代理）
- **Dev:** 根 `.env` `API_PORT=3101`, `WEB_PORT=5180`；`pnpm dev` 并行 API+Web
- **Auth:** 单 `sid` Cookie；教师 `teacherId` 与学生 `studentRosterEntryId` 字段隔离；`saveSession` 显式落库
- **Delivered:** 三种客观题导入、名单导入、学生验证入场、考试三态、提交计分、xlsx 双表导出（证号脱敏）

## Requirements

### Validated (v1.0)

- ✓ 专用服务器部署 Web 服务，局域网内可访问 — v1.0 (INFRA-01)
- ✓ 教师端：导入单选、多选、判断题 — v1.0 (QBANK-01～03)
- ✓ 教师端：导入考试名单（姓名、身份证号）— v1.0 (ROST-01)
- ✓ 学员端：姓名 + 身份证强绑定校验后进入考试 — v1.0 (AUTH-02)
- ✓ 学员端：按考试完成答题与提交 — v1.0 (EXAM-01, EXAM-02)
- ✓ 教师端：导出成绩汇总与答题明细 — v1.0 (EXPR-01, EXPR-02)
- ✓ 教师登录与会话管理 — v1.0 (AUTH-01)

### Active (next milestone)

- [ ] 补完 Phase 2/3 人工 UAT 清单（见 STATE.md Deferred Items）
- [ ] 生产环境 SESSION_SECRET、备份与日志保留策略文档化
- [ ] （可选）SEC-01～03 防作弊增强 — 见 v2 需求

### Out of Scope

- **公网 SaaS 化部署与多端租户** — 机房内网场景
- **高级防作弊**（监考视频、屏幕录制、行为 AI 等）— v2 里程碑
- **填空/简答/编程题** — v1 仅客观题
- **原生移动 App** — v1 Web only

## Context

- **动机：** 局域网闭环，减少广域网作弊面
- **用户：** 监考/命题教师（`/admin`）；考生（`/exam`）
- **合规：** 证号明文存库（内网假设）；导出 xlsx 脱敏；保留周期由校方政策决定
- **规模：** v1 单考场/单批次可行为目标

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 专用服务器 + Compose 交付 | 机房可复现部署 | ✓ Good — v1.0 |
| 学员强绑定（姓名 + 身份证） | 降低代答 | ✓ Good — v1.0 |
| v1 不追求高级防作弊 | 缩短首版路径 | ✓ Good — 保持 Out of Scope |
| Web 形态 | 免客户端分发 | ✓ Good — v1.0 |
| 单 `sid` 字段隔离（非双 Cookie） | 双 session 中间件不可靠 | ✓ Good — 2026-05-17 修订 |
| `saveSession` + 401/403 分流 | 教师端闪退、假登录 | ✓ Good — D-09/D-10 |
| QBANK-02 多选 ALL_OR_NOTHING | 阅卷简单 | ✓ Good — v1.0 |
| 考试三态 + 教师显式开始/结束 | 考场流程 | ✓ Good — v1.0 |

## Next Milestone Goals

- 关闭延期 UAT/验证项或明确接受为已知限制
- 防作弊与体验增强（SEC/UX v2）按校方优先级选型
- 并发与多考场压测（若校方有指标）

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check
3. Audit Out of Scope
4. Update Context with current state

---
*Last updated: 2026-05-17 after v1.0 milestone shipped*

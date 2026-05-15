# Phase 3: 名单与学生入场 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 3-名单与学生入场
**Areas discussed:** 身份证录入与存储策略, 入场成功后的会话与准备页

---

## 身份证录入与存储策略

| Option | Description | Selected |
|--------|-------------|----------|
| A | 18 位完整身份证号 | ✓ |
| B | 仅后 N 位 | |
| C | 导入全号 / 录入后 N 位 | |

| Option | Description | Selected |
|--------|-------------|----------|
| A | 明文存储 | ✓ |
| B | 单向哈希 | |
| C | 应用层加密 | |

| Option | Description | Selected |
|--------|-------------|----------|
| A | 规范化：trim + x→X + 全角转半角 | |
| B | 严格字面一致 | |
| C | 仅去首尾空格 | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| A | 18 位格式 + 校验码算法 | ✓ |
| B | 仅长度与字符集 | |
| C | 不校验格式 | |

**User's choice:** 1A, 2A, 3C, 4A

**Notes:** 导入模板须强调除首尾空格外与证件一致；格式错误不查库。

---

## 入场成功后的会话与准备页

| Option | Description | Selected |
|--------|-------------|----------|
| A | 独立学生 Session（如 `student_sid`） | ✓ |
| B | 无持久 Session | |
| C | 与教师共用 Cookie 名、字段区分 | |

| Option | Description | Selected |
|--------|-------------|----------|
| A | 姓名 + 等待文案，不展示完整证件号 | |
| B | 极简占位 | |
| C | 姓名 + 脱敏证件号 | |
| **定制** | **完整姓名 + 完整身份证号 +「请等待监考教师开始考试」** | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| A | Session：`rosterEntryId` + 姓名；证件号不入 session | ✓（规划默认，用户未单独选题） |
| B | Session 含明文证件号 | |
| C | 仅 `rosterEntryId` | |

| Option | Description | Selected |
|--------|-------------|----------|
| A | 提供退出；刷新保持登录 | ✓ |
| B | 无退出，依赖过期 | |
| C | 退出 + 短 TTL | |

**User's choice:** 1A；2 为定制全号展示；3 按 CONTEXT D-07；4A

**Notes:** 用户明确要求准备页展示完整身份证号；内网场景接受。

---

## Claude's Discretion

- 名单导入格式、批次、重复处理（原灰区 2）
- 校验失败统一文案与 rate limit（原灰区 3）
- Session 默认 TTL、学生路由路径命名、管理端列表是否脱敏

## Deferred Ideas

- 灰区 2、3 — 未在本轮讨论，见 CONTEXT.md Planner discretion
- 导出/日志身份证脱敏 — Phase 4 或部署文档

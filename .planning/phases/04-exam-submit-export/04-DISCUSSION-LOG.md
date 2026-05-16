# Phase 4: 考试、提交与导出 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 4-考试、提交与导出
**Areas discussed:** 开考与考试状态

---

## 开考与考试状态

| Option | Description | Selected |
|--------|-------------|----------|
| 三态：草稿 → 进行中 → 已结束 | 结束后不可再答，仍可导出/查看（与监考开收卷一致） | ✓ |
| 两态：未开始 / 进行中 | 无单独已结束态 | |
| 你决定 | plan-phase 默认三态 | |

**User's choice:** 三态（草稿 → 进行中 → 已结束）

---

| Option | Description | Selected |
|--------|-------------|----------|
| 教师显式「开始考试」 | 从草稿切入进行中 | ✓ |
| 学生首次打开即开考 | 隐式触发 | |
| 计划开始时间 | 定时开考；v1 可简化 | |

**User's choice:** 教师显式「开始考试」

---

| Option | Description | Selected |
|--------|-------------|----------|
| 准备页短轮询 + 自动跳转 | 建议间隔 3～5 秒量级（plan-phase 定精确值） | ✓ |
| 手动刷新 / 点「刷新状态」 | 无轮询 | |
| SSE/WebSocket | 实时推送 | |

**User's choice:** 短轮询 + 自动跳转

---

| Option | Description | Selected |
|--------|-------------|----------|
| 教师显式「结束考试」 | 从进行中切入已结束 | ✓ |
| 全员提交后自动结束 | 弃考可能不收尾 | |
| 两者都要 | 教师结束 + 可选自动辅助 | |

**User's choice:** 教师显式「结束考试」

---

**Notes:** 用户仅选择讨论灰区列表中的第 1 项；灰区 2～7 未在本次会话中选题，记入 `04-CONTEXT.md` 的 Planner discretion。

## Claude's Discretion

（无 — 用户未选「你决定」类选项。）

## Deferred Ideas

（无超出 Phase 4 边界之新能力提议；其余未决项已记入 CONTEXT 之 Planner discretion。）

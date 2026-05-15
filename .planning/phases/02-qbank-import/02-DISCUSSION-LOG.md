# Phase 2: 题库导入 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 2-题库导入
**Areas discussed:** 导入文件格式

---

## 导入文件格式

| Option | Description | Selected |
|--------|-------------|----------|
| Excel (.xlsx) | 机房教师熟悉；与用户提供模板一致 | ✓ |
| CSV (UTF-8) | 实现简单 | |
| 两种都支持 | 成本更高 | |

**User's choice:** 按用户桌面文件 `题库导入模板.xlsx` 导入；已复制为 `docs/templates/题库导入模板.xlsx`。

**Notes:** 单 sheet「题库导入」混排三题型；`【示例】` 行自动跳过；A～F 可扩展 G～Z；题型中英文别名；判断题可自动补 A/B 文案。

### 跟进问题

| 问题 | 选项 | Selected |
|------|------|----------|
| 警种列本阶段范围 | 1 入库+筛选 / 2 仅入库 / 3 忽略 | **3 忽略** |
| 管理端下载模板 | 1 提供下载 / 2 仅文档 | **1 提供下载** |
| 是否还有补充 | 1 无 / 2 还有 | **1 无** |

---

## Claude's Discretion

- 多选题计分、导入事务、预览 UI、重复导入策略 — 未在本轮讨论，见 CONTEXT.md「Planner discretion」。

## Deferred Ideas

- 警种维度入库与筛选 — 后续里程碑
- 灰区 2～6 — 留待 `/gsd-plan-phase 2` 定案

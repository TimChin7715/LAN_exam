# Phase 5: 导出汇总逐题得分 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 5-导出汇总逐题得分
**Areas discussed:** 已提交缺答显示、得分列格式、宽表可读性、验收与样例、边界场景

---

## 已提交但某题无作答记录

| Option | Description | Selected |
|--------|-------------|----------|
| 显示 0 | 不答题按零分计 | ✓ |
| 显示 — | 与未提交区分 | |
| 留空 | | |

**User's choice:** 显示 0，不答题按零分计算  
**Notes:** 与答错 0 分在表上均为 `0`，不单独区分缺答。

---

## 得分列格式

| Option | Description | Selected |
|--------|-------------|----------|
| 整数 only | | |
| 允许小数，0 显式写 0 | 与明细一致，零分不空着 | ✓ |

**User's choice:** 允许小数；显式写 `0`  
**Notes:** —

---

## 宽表可读性（Excel/WPS）

| Option | Description | Selected |
|--------|-------------|----------|
| 冻结窗格/列宽等 | 便于人工浏览 | |
| 不需要 | 表导入外系统 | ✓ |

**User's choice:** 不需要考虑可读性  
**Notes:** 不做冻结首行/前 5 列等。

---

## 验收与校方样例

| Option | Description | Selected |
|--------|-------------|----------|
| 对照 test1-成绩导出.xlsx | 校方宽表用法 | ✓ |
| 自动化：汇总列 vs 明细得分 | 一致性回归 | ✓ |

**User's choice:** 是；是  
**Notes:** Fixture 路径见 CONTEXT `fixtures/export/test1-成绩导出.xlsx`。

---

## 边界：0 题 / 异常数据

| Option | Description | Selected |
|--------|-------------|----------|
| 单独讨论 | | |
| 不需要 | 由实现自然处理 | ✓ |

**User's choice:** 不需要  
**Notes:** Planner discretion 记录 N=0 等。

---

## Claude's Discretion

- 宽表数据组装实现方式、fixture 测试粒度（见 CONTEXT.md）。

## Deferred Ideas

None.

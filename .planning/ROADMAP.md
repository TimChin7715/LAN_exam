# Roadmap: 局域网考试系统

## Milestones

- ✅ **v1.0 局域网考试 MVP** — Phases 1–4（shipped 2026-05-17）
- ✅ **v1.1 考试情况导出细化** — Phase 5（shipped 2026-05-17）

## Phases

<details>
<summary>✅ v1.0 局域网考试 MVP (Phases 1–4) — SHIPPED 2026-05-17</summary>

- [x] **Phase 1: 基础服务与教师认证** — 3/3 plans
- [x] **Phase 2: 题库导入** — 3/3 plans
- [x] **Phase 3: 名单与学生入场** — 2/2 plans
- [x] **Phase 4: 考试、提交与导出** — 3/3 plans

完整阶段详情见 [`.planning/milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md)。

</details>

### Phase 5: 导出汇总逐题得分

**Goal:** 在现有 xlsx 导出上，让「成绩汇总」表一眼看到每位考生每道题得分，与校方 `test1-成绩导出.xlsx` 用法一致并保留「答题明细」长表。

**Requirements:** EXPR-03, EXPR-04

**Plans:** 1 plan

Plans:
- [x] 05-01-PLAN.md — Fixture (D-07), wide 成绩汇总 (EXPR-03), export tests (D-08, EXPR-04)

**Success criteria:**

1. 教师导出已结束（或可导出）考试后，打开 xlsx「成绩汇总」表：前 5 列为姓名、脱敏证号、总分、是否提交、提交时间；其后为「第1题」至「第N题」列（N = 当次考试题数）
2. 已提交考生：各题列数值与该生提交计分结果一致（与「答题明细」中同题 `得分` 一致）
3. 未提交考生：总分与各题得分列均为「—」，是否提交为「未提交」
4. 「答题明细」工作表仍存在且列与 v1.0 一致（长表逐题一行）
5. 导出文件仍可用 Excel/WPS 打开，中文表头无乱码；证号仍为脱敏格式

## Progress

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1–4 | v1.0 | 11/11 | Complete | 2026-05-17 |
| 5. 导出汇总逐题得分 | v1.1 | 1/1 | Complete | 2026-05-17 |

---
*Roadmap updated: 2026-05-17 — milestone v1.1*

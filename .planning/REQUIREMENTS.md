# Requirements: 局域网考试系统 — Milestone v1.1

**Defined:** 2026-05-17  
**Core Value:** 在局域网内，学员能按名单强绑定身份完成考试，教师能可靠地导入题目与名单并导出成绩与答题明细。

## v1.1 Requirements

### 导出

- [ ] **EXPR-03**: 教师导出考试 xlsx 时，「成绩汇总」工作表在姓名、脱敏证号、总分、是否提交、提交时间之后，按题号递增追加各题得分列（表头为「第1题」「第2题」…「第N题」，N 为当次考试题目数）；已提交考生显示该题 `pointsAwarded`，未提交考生各题得分为「—」
- [ ] **EXPR-04**: 导出仍包含 v1.0「答题明细」长表工作表（姓名、证号、题号、题型、所选、正确答案、对错、得分），内容与 v1.0 行为一致

## v2 Requirements

_(Unchanged from v1.0 archive — SEC/UX; not in v1.1 roadmap.)_

### 防作弊增强

- **SEC-01**: 切屏检测与日志
- **SEC-02**: 试题乱序 / 选项乱序
- **SEC-03**: 考试时间窗与迟到策略

### 体验

- **UX-01**: 断网重连后继续作答（会话恢复）

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| 汇总表增加题干/所选/对错列 | 用户仅需逐题得分；明细表已覆盖 |
| 导出明文证号 | 保持 v1.0 脱敏策略 |
| 统计概况工作表 / CSV / 拆分文件 | 非本里程碑 |
| 进行中考试导出 | 仍仅在教师可导出时生成（与 v1.0 一致） |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXPR-03 | Phase 5 | Pending |
| EXPR-04 | Phase 5 | Pending |

**Coverage:**
- v1.1 requirements: 2 total
- Mapped to phases: 2
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17 — milestone v1.1*

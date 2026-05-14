# 局域网考试系统（LAN Exam）

## What This Is

面向机房/教室场景的 **Web 局域网考试系统**：在 **专用服务器** 上长期运行服务，教师通过浏览器维护题库与考生名单并导出成绩；学员通过浏览器登录并完成考试。目标是用 **局域网闭环** 替代依赖广域网的考试方式，从环境上减少远程代考、外网搜题等作弊路径。第一版 **不追求** 复杂防作弊能力，以「可用 + 可审计导出」为主。

## Core Value

**在局域网内，学员能按名单强绑定身份完成考试，教师能可靠地导入题目与名单并导出成绩与答题明细。**

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 专用服务器部署 Web 服务，局域网内可访问
- [ ] 教师端：导入单选、多选、判断题及答案结构
- [ ] 教师端：导入考试名单（姓名、身份证号）
- [ ] 教师端：导出成绩与答题情况（可审计的明细）
- [ ] 学员端：通过 **姓名 + 身份证号** 与名单 **强绑定** 校验后进入并完成考试
- [ ] 学员端：按教师配置的试卷/考试完成答题与提交

### Out of Scope

- **公网 SaaS 化部署与多端租户** — 明确为机房内网场景，不做多租户云服务模型
- **高级防作弊**（实时监考视频、屏幕录制、行为 AI 分析、人脸活体等）— v1 明确不追求；后续里程碑单独立项
- **除三种题型外的题型**（填空、简答、编程题等）— v1 不包含，避免阅卷复杂度
- **原生移动 App** — v1 仅 Web；移动端浏览器「尽力兼容」不作为必须交付

## Context

- **动机**：广域网考试中作弊手段多、环境难控；局域网可将考试流量与数据留在可控边界内。
- **用户角色**：监考/命题教师（管理端）；考生（考试端）。
- **身份强绑定**：登录校验字段需与导入名单一致；**身份证全号 vs 后若干位**、存储是否哈希、导出脱敏策略在实现阶段与校方合规要求对齐后确定。
- **技术形态**：浏览器访问同一服务；前后端技术栈在 Phase 1 规划中选定（未锁定）。

## Constraints

- **网络**：考试业务流量应限制在局域网；服务器部署位置与访问控制由校方环境决定。
- **合规与隐私**：身份证号属敏感个人信息；导出与日志保留周期需符合组织政策（在需求细化与验收中明确）。
- **并发与规模**：v1 以「单考场/单批次」可行为目标；极端并发数字在部署方案中再验证。

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 专用服务器部署 | 稳定服务入口、便于统一备份与权限管理 | — Pending |
| 学员强绑定（姓名 + 身份证） | 用户明确要求，降低代答入口 | — Pending |
| v1 不追求高级防作弊 | 用户明确取舍，缩短首版交付路径 | — Pending |
| Web 形态 | 用户选择，降低客户端分发成本 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-15 after initialization*

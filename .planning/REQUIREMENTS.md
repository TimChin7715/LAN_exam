# Requirements: 局域网考试系统

**Defined:** 2026-05-15  
**Core Value:** 在局域网内，学员能按名单强绑定身份完成考试，教师能可靠地导入题目与名单并导出成绩与答题明细。

## v1 Requirements

### 部署与访问

- [ ] **INFRA-01**: 管理员能在专用服务器上部署并启动系统，考场局域网内任意授权终端通过浏览器访问服务根地址无报错

### 认证与授权

- [ ] **AUTH-01**: 教师使用受保护凭据登录管理端；未登录用户无法访问题目与成绩等管理功能
- [ ] **AUTH-02**: 学生输入姓名与身份证号后，系统与已导入名单逐字段匹配，仅全部一致时允许进入待参加的考试

### 题库

- [ ] **QBANK-01**: 教师能批量导入单选题（题干、选项、正确答案、分值或默认分值策略）
- [ ] **QBANK-02**: 教师能批量导入多选题（含部分分策略或统一计分规则，规则在实现中固定并写入验收说明）
- [ ] **QBANK-03**: 教师能批量导入判断题（题干、正确判断、分值）

### 名单

- [ ] **ROST-01**: 教师能批量导入考试名单列：姓名、身份证号；导入后可在管理端预览或检索以确认

### 考试与作答

- [ ] **EXAM-01**: 教师能为一次考试关联已导入题目与名单，学生仅能看到属于自己的试卷并完成作答与提交
- [ ] **EXAM-02**: 学生提交后不能在未授权情况下修改答卷；同一学生在同一考试重复提交行为有明确提示或拒绝策略

### 导出

- [ ] **EXPR-01**: 教师能导出一次考试的成绩汇总（至少包含学生标识、总分、是否提交）
- [ ] **EXPR-02**: 教师能导出答题明细（每题作答选项/对错、得分），格式便于存档（如 CSV 或 Excel 之一）

## v2 Requirements

### 防作弊增强

- **SEC-01**: 切屏检测与日志
- **SEC-02**: 试题乱序 / 选项乱序
- **SEC-03**: 考试时间窗与迟到策略

### 体验

- **UX-01**: 断网重连后继续作答（会话恢复）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 公网统一认证 / OAuth | v1 为局域网内网系统 |
| 移动端原生应用 | v1 Web 优先 |
| 主观题与人工阅卷流 | v1 仅客观题 |
| 实时监考视频 | v1 明确不追求高级防作弊 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| QBANK-01 | Phase 2 | Pending |
| QBANK-02 | Phase 2 | Pending |
| QBANK-03 | Phase 2 | Pending |
| ROST-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| EXAM-01 | Phase 4 | Pending |
| EXAM-02 | Phase 4 | Pending |
| EXPR-01 | Phase 4 | Pending |
| EXPR-02 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-15*  
*Last updated: 2026-05-15 after roadmap creation*

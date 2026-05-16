---
status: complete
phase: 04-exam-submit-export
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-05-16T12:00:00Z
updated: 2026-05-16T15:06:00Z
mvp_mode: true
mvp_note: "ROADMAP Mode mvp but Goal is not User Story format — UAT derived from Success Criteria + 04-ACCEPTANCE + 04-UI-SPEC"
---

## Current Test

[testing complete]

## Tests

### 1. 教师进入考试管理
section: user-flow
expected: 已登录且已改密的教师打开 `/admin/exams`，页面显示考试列表（可为空表），有「新建考试」或等价入口；顶栏为管理端样式（非学生端）。
result: pass

### 2. 教师新建考试（组卷）
section: user-flow
expected: 在新建/编辑页选择已导入的题库批次与名单批次，保存后考试处于「草稿」状态；可看到已选批次信息，尚未开考。
result: pass

### 3. 教师开始考试
section: user-flow
expected: 在考试详情页点击「开始考试」后，状态变为进行中；同名单批次不能同时再开第二场（若尝试第二场应失败并有提示）。
result: pass

### 4. 学生准备页自动进入答题
section: user-flow
expected: 名单内学生登录后停留在 `/exam/waiting`；约 4 秒内（或教师开考后下一次轮询）自动跳转到 `/exam/take`（带 examId），无需手动刷新；页面 hidden 时轮询暂停（可选观察）。
result: pass

### 5. 学生可见试卷并作答
section: user-flow
expected: 答题页显示本场全部客观题（题干、选项）；修改选项后约 2 秒自动保存；界面上不显示标准答案或 answerKeys。
result: pass

### 6. 学生提交试卷
section: user-flow
expected: 点击提交并确认后，出现成功提示或进入只读/已提交态；无法继续修改选项（或保存被拒绝）。
result: pass

### 7. 教师端可见提交记录
section: user-flow
expected: 教师打开该场考试详情/成绩表，能看到该生的提交记录：姓名、脱敏证号、总分、提交时间等。
result: pass

### 8. 学生重复提交被拒绝
section: user-flow
expected: 已提交学生再次尝试提交时，收到明确中文提示「您已提交过本场考试，无法再次提交。」（或页面等价文案），无法产生第二条提交记录。
result: pass

### 9. 教师结束考试
section: user-flow
expected: 教师点击「结束考试」后，考试变为已结束；学生无法再保存答案或提交。
result: pass

### 10. 教师导出成绩与明细
section: user-flow
expected: 已结束的考试可一键导出 `.xlsx`；用 Excel 或 WPS 打开后有两个工作表「成绩汇总」「答题明细」；汇总含名单内全部考生（含未提交）；证号列为脱敏（18 位为前 6 + ******** + 后 4），无完整 18 位证号。
result: pass

### 11. 学生提交后只读回看
section: user-flow
expected: 已提交学生可查看自己的作答回放（所选选项、对错、得分），界面不展示题库标准答案 answerKeys。
result: pass

### 12. 非名单学生无法参加
section: user-flow
expected: 未在本场考试名单批次内的学生尝试进入该场考试时，被拒绝并显示笼统提示「当前无法参加本场考试。」（不泄露考试是否存在等细节）。
result: pass

### 13. Cold Start Smoke Test
section: technical
expected: 停止现有服务。清理临时状态（如需要）。从干净状态启动（`docker compose up --build` 或 README 的一键命令）。服务无报错启动，迁移完成，`GET /health` 返回 `{"status":"ok"}`。
result: pass

### 14. 计分单元测试
section: technical
expected: 在项目根目录运行 `node --import tsx --test apps/server/src/lib/exam/score-question.test.ts`，全部用例通过（含多选 ALL_OR_NOTHING）。
result: pass

### 15. 试卷 API 不返回答案键
section: technical
expected: 学生 session 下请求试卷接口（如 `GET /api/student/exam/paper`）的 JSON 响应中不包含 `answerKeys` 字段。
result: pass

### 16. 已结束考试拒绝写入
section: technical
expected: 考试状态为 ENDED 后，学生保存草稿或提交接口返回拒绝（409 或同等），无法新增/修改提交。
result: pass

### 17. 成功标准：组卷与答题闭环
section: coverage
expected: 教师创建一次考试并关联题目与名单后，名单内学生可见试卷并完成答题（对应 ROADMAP Phase 4 成功标准 1）。
result: pass

### 18. 成功标准：提交与防重复
section: coverage
expected: 学生提交后管理端可见最终记录；重复提交行为符合 EXAM-02（409 + 固定中文文案）（对应 ROADMAP 成功标准 2）。
result: pass

### 19. 成功标准：导出可用
section: coverage
expected: 导出文件包含成绩汇总与题目级明细，表格软件可打开且中文表头正常（对应 ROADMAP 成功标准 3）。
result: pass

## Summary

total: 19
passed: 19
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

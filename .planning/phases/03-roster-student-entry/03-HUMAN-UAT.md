---
status: partial
phase: 03-roster-student-entry
source: [03-VERIFICATION.md]
started: 2026-05-16T14:00:00Z
updated: 2026-05-16T14:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 名单导入与检索
expected: 教师导入合法 xlsx 后可在 /admin/roster 搜索到记录
result: [pending]

### 2. 学生正确凭据登录
expected: 名单内姓名+证号 → /exam/waiting 显示全名、全号、等待文案
result: [pending]

### 3. 学生错误凭据
expected: 401 统一「姓名或身份证号不正确…」；格式错误 400「身份证号格式不正确」
result: [pending]

### 4. 双 session 并存
expected: 教师 /admin 仍可用同时学生已登录 waiting
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

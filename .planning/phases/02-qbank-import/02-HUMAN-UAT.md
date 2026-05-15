---
status: partial
phase: 02-qbank-import
source: [02-VERIFICATION.md]
started: 2026-05-16
updated: 2026-05-16
---

## Current Test

导入含单选/多选/判断（非【示例】行）的 xlsx，验证成功摘要与列表

## Tests

### 1. 混合题型合法导入
expected: 200 成功；本批预览最多 3 题；列表「全部题型」可见单选/多选/判断 Badge
result: [pending]

### 2. 非法文件零入库
expected: 400 + 行级错误表；导入前后列表总条数不变
result: [pending]

### 3. 多选题计分规则可见
expected: 详情 Dialog 显示「全对满分，否则 0 分」说明
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

---
status: complete
phase: 01-foundation-auth
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md
started: 2026-05-15T00:00:00Z
updated: 2026-05-15T15:00:00Z
mvp_mode: true
mvp_note: "ROADMAP Mode mvp but Goal is not User Story format — UAT derived from Success Criteria + 01-UI-SPEC"
---

## Current Test

[testing complete]

## Tests

### 1. 学生端首页占位
section: user-flow
expected: 浏览器打开 `/` 显示学生端占位文案，无表单、无管理端入口
result: pass

### 2. 教师登录页
section: user-flow
expected: 打开 `/admin/login`，显示标题「教师登录」、副标题「局域网考试系统 · 管理端」、用户名与密码字段、主按钮「登录管理端」；页面上没有「忘记密码」链接
result: pass

### 3. 错误凭据登录
section: user-flow
expected: 输入错误用户名或密码并提交后，表单顶部出现红色 Alert，文案为「用户名或密码错误，请检查后重试。」（不区分是用户名错还是密码错）
result: pass

### 4. 正确凭据登录（首登）
section: user-flow
expected: 使用种子账号 `teacher_admin` 与 `SEED_ADMIN_PASSWORD` 登录后，自动进入 `/admin/change-password`，显示「设置新密码」及说明「首次登录须修改默认密码后方可使用管理功能。」
result: pass

### 5. 首次登录改密
section: user-flow
expected: 填写当前密码、新密码（≥8 位）、确认新密码并点击「保存新密码」后，进入管理端仪表盘（`/admin` 或 `/admin/dashboard`），不再停留在改密页
result: pass

### 6. 管理端仪表盘占位
section: user-flow
expected: 顶栏左侧「局域网考试系统」，右侧显示当前教师用户名与「退出登录」；主区有欢迎标题与「管理功能筹备中」类占位说明；题库/名单/考试为灰色不可点的「即将开放」卡片
result: pass

### 7. 未登录访问受保护路由
section: user-flow
expected: 在未登录（或已退出）状态下直接访问 `/admin` 或 `/admin/dashboard`，应重定向到 `/admin/login`（可带 redirect 参数），无法看到仪表盘内容
result: pass

### 8. 退出登录
section: user-flow
expected: 在仪表盘点击「退出登录」后回到登录页；再次访问 `/admin` 会要求重新登录
result: pass

### 9. Cold Start Smoke Test
section: technical
expected: 停止现有服务。清理临时状态（如需要）。从干净状态启动（`docker compose up --build` 或 README 的一键命令）。服务无报错启动，迁移与 seed 完成，`curl` 或浏览器访问 `GET /health` 返回 `{"status":"ok"}`
result: pass

### 10. 健康检查含数据库
section: technical
expected: 在数据库正常运行时，`curl -s http://127.0.0.1:3101/health` 返回 `{"status":"ok"}`；若故意停掉数据库，健康检查应失败（非 ok）
result: pass

### 11. Docker Compose 启动栈
section: technical
expected: 设置 `SEED_ADMIN_PASSWORD` 后 `docker compose up --build` 可拉起 db + app；日志中 migrate 与 seed 成功；API 端口可访问 `/health`
result: pass

### 12. 局域网浏览器访问
section: coverage
expected: 在目标部署方式下，从局域网内另一台机器的浏览器打开首页或登录页（文档中的 URL），无连接拒绝；页面可加载（若仅 API 端口可用、无 SPA，如实记录）
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

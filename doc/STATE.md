# 项目状态

> 最后更新：2026-06-03

## 当前焦点

- **功能开发**：同一名单批次多场 `IN_PROGRESS` — 学员选考（`exam-select`）、`resolve-student-exam-status`、session `examId`；题库 `importSortOrder` + 迁移 `20260602120000_question_import_sort_order`。
- **考场交付**：Windows 安装包 **v1.6.29**（`dist\LAN-Exam-Setup-v1.6.29.exe`）；现场踩坑与修复编年见 **[INSTALLER_FIXES.md](../INSTALLER_FIXES.md)**（§14–§18 为近期真机问题）。
- **版本**：`VERSION` = **1.6.29**（发版以根目录 `VERSION` 为准；`package.json` 仍为 1.6.0）。

## 进度

- [x] 产品基线：三类题型、混合考试、座位表、考后导出、进度同步、到点交卷
- [x] 考官免登录 + loopback 管理 API
- [x] 学员手动交卷：未作答可确认后提交（v1.6.26 业务）
- [x] 安装脚本加固：Postgres 180s、Prisma 可读检测、防火墙 public、半安装恢复（v1.6.24–v1.6.29，见 INSTALLER_FIXES）
- [x] 发版产物 v1.6.29 已在本机构建机打出
- [ ] **进行中**：多考试选考 + 导入顺序（工作区未提交）
- [ ] 真机双机验收（考场环境）
- [ ] 功能线：migrate + 单测 + 手测

## 阻塞

- 无硬阻塞。考场若半安装：按 `INSTALLER_FIXES.md` §15 管理员跑 `install.bat`，勿只拷 logs。

## 近期变更

- 2026-06-03：上下文接力；**INSTALLER_FIXES.md** 标为 Windows/考场踩坑权威（§14–§18）。
- 2026-06-03：`LAN-Exam-Setup-v1.6.29.exe` 打包；含 v1.6.26 防火墙 public + 缺项确认交卷。
- 工作区 WIP：`exam-select`、`resolve-student-exam-status`、`materialize-questions`、学员页等（未提交）。

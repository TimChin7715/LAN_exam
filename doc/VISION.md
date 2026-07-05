# 愿景与范围

## 一句话

机房 / 教室场景的 **局域网 Web 考试系统**：管理机兼服务器，考官在本机管理台操作，学员经 LAN 访问考试端，考场 **不依赖外网**。

## 目标用户与场景

- **考官**：单台管理机，导入题库/名单、创建混合考试、监考、导出成绩与附件。
- **学员**：教室 PC，姓名 + 身份证号登录，作答客观题 / 操作题，支持断网续考与到点交卷。
- **运维/实施**：Windows 离线 `LAN-Exam-Setup.exe` 一键安装 + 托盘常驻（推荐交付）。

## In scope

- 两类题型（导入规则见 [DEPLOY.md](DEPLOY.md)）：
  - **客观题**：Excel/CSV；单选/多选/判断；多选计分 `ALL_OR_NOTHING`。
  - **操作题**：Word 全文展示 + Excel 答题卡（工作表 `答题卡`）+ 可选附件；每空截图佐证（不计分）。
- 名单：姓名 / 单位 / 身份证号；学员登录凭姓名 + 身份证号。
- 考试：草稿 → 进行中 → 已结束；混合模块；计划起止时间；到点自动收卷 + 考官可提前结束。
- 座位表：按考试随机分配（`random_shuffle_v1`）；设置页 `showSeatBoard` 控制展示。
- 考官默认免登录；管理 API 仅 loopback；学员经 LAN `:5180/exam/*`。
- 学员：自动保存、sync-progress、断网续考；手动交卷可确认缺项提交（v1.6.26+）。
- 考后：成绩三表 Excel、操作题截图 ZIP；设置页「清除全部数据」保留下一场前清场。
- 同一名单批次下多场 **进行中** 考试（学员选考）— 当前开发中。

## Out of scope

- 公网 SaaS、HTTPS 终止、云端更新。
- 旧 `teacher_admin` 数据迁移到 `local_exam_admin`。
- SQLite 替代 Postgres、多考官 RBAC、考后自动备份（Phase C 可选，未承诺）。

## 完成定义（Done）

- **功能**：考场双机（管理机 + 学员机）全流程可完成一场混合考试；Setup 安装后 `/health` 与版本号正确。
- **质量**：关键 exam/roster/fillin 路径有 `apps/server` 单测；改认证须前后端 `VITE_*` 成对。
- **交付**：`VERSION` 与 `dist\LAN-Exam-Setup-v*.exe` 一致；`INSTALLER_FIXES.md` 与现场检查清单可对照。

## 非功能约束

- 性能：考场削峰（拉卷/交卷/同步门控，见 `apps/server/src/lib/env.ts`）。
- 安全：管理面仅本机；5180 对 LAN 开放给学员路由；5434 仅 127.0.0.1。
- 兼容：Node 20+；Windows 考场机离线；开发可用 Docker Postgres 5434。

# Continue

> 会话结束于：2026-06-03

## Last action

- 将考场/发版踩坑沉淀到 [../INSTALLER_FIXES.md](../INSTALLER_FIXES.md)（§14–§18，当前发版 **v1.6.29**）；产出 `dist\LAN-Exam-Setup-v1.6.29.exe`。
- 实现学员**未作答可确认交卷**（`exam-submit-validation`、`StudentExamTake`、`submit.ts`）；`AGENTS.md` 已对齐。
- 分析真机半安装日志（Postgres 慢启动、Prisma junction、`lan_exam` 未创建）；明确学员须用 `/exam/login`、考官本机 `/admin`。

## Next action

**功能线（工作区 WIP，优先若继续开发）：**

1. `pnpm db:migrate`（`20260602120000_question_import_sort_order`）。
2. `cd apps/server` 后运行：
   `npx tsx --test src/lib/exam/resolve-student-exam-status.test.ts`
   `npx tsx --test src/lib/exam/materialize-questions.test.ts`
3. `pnpm dev` 手测：同名单下两场 **IN_PROGRESS** → 登录 → 选考 → waiting/take 与状态 API 一致。

**考场线（若部署最新包）：**

1. 用 `dist\LAN-Exam-Setup-v1.6.29.exe` **管理员**安装；勿与 `install.bat`/托盘并发 `install-db`。
2. 查 `logs\install.log`：`install completed`、`verify-install passed`；`curl http://127.0.0.1:5180/health` → `version":"1.6.29"`。
3. 学员机：`http://<管理机IP>:5180/exam/login`（非 `/admin`）。异常见 `INSTALLER_FIXES.md` §15–§18 与 `doc/KNOWLEDGE.md`。

## Why

安装包与业务功能两条线并行：安装脚本已在 v1.6.25+ 加固，但真机双机验收仍待做；选考/导入顺序代码未提交且未跑 migrate/手测。

## Open threads

- `VERSION`（1.6.29）与根 `package.json` version 是否统一。
- 真机双机验收（`docs/PLAN-考官免登录一键部署.md` 验收表）。
- `doc/` 与 `INSTALLER_FIXES.md`：发版编年以 **INSTALLER_FIXES** 为准，`doc/` 只保留接力摘要。

## Do not

- **勿**把 `INSTALLER_FIXES.md` 全文复制进 `doc/`（只链到对应 §）。
- **勿**用 LAN IP 打开 `/admin` 当学员入口；**勿**只改 `ADMIN_AUTH_MODE` 一侧。
- **勿**并发 Setup + `install.bat` + 托盘初始化数据库。
- **勿**在 `package.ps1` 时让 node 占用 `dist\lan-exam-win\app\server-bundle`（会删目录失败）。
- **勿**混淆 Linux 测试 **8001** 与考场 **5180**。

## 工作区备注

大量功能改动与 `INSTALLER_FIXES.md`、`VERSION` 未提交；`doc/` 可单独 commit。最新安装包路径：`dist\LAN-Exam-Setup-v1.6.29.exe`。

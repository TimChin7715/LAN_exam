# 决策记录

<!-- 每条决策追加一节，不要改历史 -->

## 2026-06-03 — 初始化 doc/ 与现有 AGENTS 决策对齐

**Context**

项目已有 `AGENTS.md` 记录考场交付与认证约束；需要独立 `doc/` 供跨会话 AI 接力，且不重复争论已关闭议题。

**Decision**

将下列结论视为长期约束，新功能不得默认推翻；细节维护仍以 `AGENTS.md` 为准。

| 议题 | 结论 |
|------|------|
| 考场交付 | 必须提供 `LAN-Exam-Setup.exe` + 桌面快捷方式；管理台仅安装机 loopback |
| 历史数据 | 不迁移；免登录绑定 `local_exam_admin`，旧 `teacher_admin` 数据不可见 |
| 托盘 | 关窗最小化；仅托盘「退出」停止 Postgres + Node |
| 防火墙 | 安装入站 **TCP 5180**（v1.6.26+ 含 public profile）；**5434 仅本机** |
| 离线 | 考场禁止外网；二进制在有网机构建机打入 Setup |
| 默认认证 | 代码与 `.env.example` 默认 `ADMIN_AUTH_MODE=disabled`，前后端 `VITE_*` 成对 |

**Alternatives**

- 恢复考场账号登录为默认 — 已否决，与一键部署目标冲突。
- 自动映射 `teacher_admin` 数据 — 已否决，避免脏数据混入免登录账号。

**Consequences**

- 新考官功能须使用 `resolveAdminTeacherId()`。
- 文档分轨：`doc/` = 接力；`docs/` = 部署；`AGENTS.md` = 代码索引。

---

## 2026-06-03 — 手动交卷允许未作答（确认后提交）

**Context**

原先手动交卷要求客观/填空/操作题全部完成，与到点自动交卷（空题 0 分）不一致；考场希望提醒缺项但仍可交卷。

**Decision**

- 前端：确认框列出未作答题（`formatSubmitConfirmDescription`），不再 toast 硬拦截。
- 后端：`submitScoredQuestionsPart` 不再 `requireComplete`；操作题统一 `finalizePracticalSubmissionIfDraft`（无上传也可交卷）。
- 到点自动交卷逻辑不变。

**Consequences**

- 未作答题按 0 分；操作题无草稿则无 `practicalSubmission` 记录。

---

## 2026-06-03 — Windows 踩坑文档以 INSTALLER_FIXES.md 为权威

**Context**

真机安装多次出现半安装、学员机无法访问、Prisma 路径假阳性；修复分散在多轮对话与版本。

**Decision**

- **[INSTALLER_FIXES.md](../INSTALLER_FIXES.md)** 为 Windows 安装包修复与考场踩坑的**编年权威**（按版本 § 记录现象、根因、现场命令）。
- **`doc/KNOWLEDGE.md`** 仅保留速查表 + § 索引 + 链到 INSTALLER_FIXES；**不**复制全文。
- **`doc/continue.md` / STATE** 发版版本以根目录 **`VERSION`** 为准（当前 1.6.29）。

**Consequences**

- 新安装问题：先查 `logs\install.log`，再对照 INSTALLER_FIXES 对应 §；文档更新时优先改 INSTALLER_FIXES，再同步 doc 摘要。

---

## 2026-06-03 — docs/ 部署信息同步至 doc/

**Context**

`doc/` 初始化后仅索引部分 `docs/` 链接，缺少部署路径选择、导入规则、Phase 状态等可接力摘要。

**Decision**

- 新增 `doc/DEPLOY.md` 作为 `docs/` 部署手册的 **要点索引**（不复制全文）。
- `README`、`SETUP`、`ARCHITECTURE`、`ENV`、`VISION`、`KNOWLEDGE` 吸收与 `docs/DEPLOY*.md`、`PLAN` 一致的操作事实。
- 长期全文仍以 `docs/` 维护；`doc/` 变更时只更新摘要，避免双处长篇漂移。

**Alternatives**

- 把 `docs/*.md` 移入 `doc/` — 否决，破坏现有 README/AGENTS 链接与实施人员习惯。

**Consequences**

- 改部署行为时：先改 `docs/`，再同步 `doc/DEPLOY.md` 及相关摘要节。

---

## 2026-05-20 — Phase A/B 免登录 + Windows 离线交付（摘自 PLAN）

**Context**

考场要求考官免登录、离线 Setup、学员 LAN 访问；见 [../docs/PLAN-考官免登录一键部署.md](../docs/PLAN-考官免登录一键部署.md)。

**Decision**

- Phase A/B **已落地**：`ADMIN_AUTH_MODE`、loopback 守卫、5180 合一、Inno Setup + 托盘 + 便携 Postgres/Node、VC++ 静默安装。
- **双机真机验收**仍为待执行项（非代码缺失）。
- Phase C（考后自动备份等）为可选，**非**当前承诺。

**Consequences**

- 新功能不得假设考官账号登录为默认路径。
- 验收清单与风险表以 PLAN 全文为准。

# Milestones

## v1.0 局域网考试 v1.0 MVP (Shipped: 2026-05-17)

**Phases completed:** 4 phases, 11 plans, 25 tasks

**Known deferred items at close:** 5 (7 pending HUMAN-UAT scenarios + verification debt — see STATE.md Deferred Items)

**Key accomplishments:**

- Monorepo、/health、Docker Compose 与双路径部署文档就绪，为 Prisma 与认证计划铺好基础设施。
- Teacher 表迁移与 argon2 种子账号、Compose 启动时 migrate/seed，以及 Prisma SELECT 1 启动与深度健康检查。
- express-session + PostgreSQL store with HttpOnly cookie, unified login errors, first-login password change gate, and admin SPA aligned to 01-UI-SPEC.
- Prisma question domain with ExcelJS parse/validate, atomic batch import, and admin template/import/list APIs with ALL_OR_NOTHING multi-select scoring
- Admin question bank page with Excel template download, import feedback, paginated list, and detail dialog wired to Phase 2 APIs
- MULTI questions show ALL_OR_NOTHING scoring in detail dialog, list filter, and phase acceptance doc for Phase 4
- Roster Excel import with GB 11643 validation, atomic batch writes, admin search UI, and masked ID list at /admin/roster
- Independent student_sid session with roster-bound verify, generic failure copy, and exam login/waiting UI guarded by StudentRoute
- Prisma exam lifecycle (三态), teacher CRUD/start APIs, student paper/draft endpoints without answer keys, and 4s waiting-page poll to `/exam/take`.
- Server-side scoring on submit, one-time submit with 409, teacher end exam, admin submission list, and full student/admin exam UI.
- ExcelJS dual-sheet export: 成绩汇总 + 答题明细, masked IDs, unsubmitted rows in summary.

## v1.1 考试情况导出细化 (In progress: 2026-05-17)

**Scope:** 「成绩汇总」表追加第1题～第N题得分列；保留「答题明细」长表。

**Requirements:** EXPR-03, EXPR-04 → Phase 5

---

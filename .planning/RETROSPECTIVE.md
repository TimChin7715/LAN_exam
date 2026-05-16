# Retrospective

Living document — append per milestone; trends at bottom.

## Milestone: v1.0 — 局域网考试 MVP

**Shipped:** 2026-05-17  
**Phases:** 4 | **Plans:** 11

### What Was Built

- 局域网 Web 考试闭环：教师认证、题库/名单 xlsx 导入、学生强绑定入场、考试三态、提交计分、成绩与明细 xlsx 导出（证号脱敏）
- Docker Compose + pnpm 双路径开发；Fastify + Prisma + React/shadcn

### What Worked

- MVP 垂直切片（每阶段 PLAN → SUMMARY）与 ROADMAP 四阶段顺序清晰
- 复用 Phase 2 导入管道模式到名单域
- Phase 4 自动化 UAT 覆盖考试主路径

### What Was Inefficient

- REQUIREMENTS/ROADMAP 进度表与磁盘 SUMMARY 长期不同步
- 双 `student_sid` session 中间件导致开发期登录不稳定（后改为单 `sid` + `saveSession`）
- Phase 2/3 人工 UAT 未在关里程碑前完成

### Patterns Established

- 单 `sid` + 字段隔离 + 显式 `saveSession`；`skipAuthRedirect` 分流 401/403
- 根 `.env` 统一端口；`pnpm dev` 并行起前后端
- ALL_OR_NOTHING 多选计分契约写入 ACCEPTANCE 供 Phase 4 消费

### Key Lessons

- 规划文档须在代码修复后同步 CONTEXT/DECISIONS-INDEX，否则 Agent 按过期决策改码
- `resave: false` 的 express-session 必须每次变更后 `saveSession`
- 关里程碑前应跑 `/gsd-verify-work` 或接受 STATE Deferred Items

## Cross-Milestone Trends

| Milestone | Plans | Deferred at close |
|-----------|-------|-------------------|
| v1.0 | 11 | 5 verification/UAT items |

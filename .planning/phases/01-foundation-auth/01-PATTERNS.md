# Phase 1 — 模式映射（Pattern Map）

**生成日期:** 2026-05-15  
**结论:** 仓库为 **绿地**，无既有应用源码可对照；本文件仅记录「首版应对齐的外部模式」供执行器查阅。

## 最接近的类比

| 拟创建文件/目录 | 角色 | 类比来源 | 说明 |
|------------------|------|----------|------|
| `apps/server` Fastify 插件链 | HTTP + Session | Fastify 官方插件示例 `[CITED: fastify.dev]` | `cookie` → `session` → `routes` 顺序 |
| `apps/web` 路由守卫 | SPA auth guard | React Router loader/action 或 layout 层封装 `[ASSUMED]` | 与 `01-UI-SPEC.md` 四态矩阵对齐 |
| `prisma/schema.prisma` | 数据模型 | Prisma 文档「PostgreSQL + migrate + seed」`[CITED: prisma.io]` | Teacher 表 + 会话表（若使用 connect-pg-simple） |

## 代码摘录

无 — 待 Plan 01-01 创建首份源码后，在后续阶段更新本文件。

## PATTERN MAPPING COMPLETE

# Fastify 插件与守卫

本目录注册全局中间件与路由级 `preHandler`。详见 [AGENTS.md](../../../../AGENTS.md) 认证章节。

## 注册顺序（`apps/server/src/index.ts`）

1. **`session.ts`** — `sessionPlugin`：PostgreSQL 会话存储（`connect-pg-simple`），供考官 `session` 模式与学员登录共用 cookie 机制。
2. **`admin-loopback-guard.ts`** — `registerAdminLoopbackGuard`：在路由匹配前限制来源 IP。
3. 各路由再按需挂载 **`admin-guard`** 或 **`student-guard`** 的 `preHandler`。

## 文件职责

| 文件 | 类型 | 作用 |
| --- | --- | --- |
| `session.ts` | Fastify 插件 | 初始化 `express-session`；生产要求 `SESSION_SECRET`（≥16 字符） |
| `admin-loopback-guard.ts` | 全局钩子 | `ADMIN_API_LOOPBACK_ONLY=true` 时，非 loopback 访问 `/api/admin/*` 返回 **403**；`ADMIN_AUTH_MODE=disabled` 时 `/api/auth/*` 同样仅 loopback |
| `admin-guard.ts` | `preHandler` | `requireAdminSession`：`disabled` 直接放行；`session` 校验考官 cookie、改密状态 |
| `student-guard.ts` | `preHandler` | `requireStudentSession` / `ensureStudentRosterEntryId`：校验学员 session 中的 `rosterEntryId` |

## 与认证模式的关系

| 模式 | 考官 API | 学员 API |
| --- | --- | --- |
| `ADMIN_AUTH_MODE=disabled`（默认） | loopback 守卫 + `requireAdminSession` 免登录；数据写入 `LOCAL_ADMIN_USERNAME`（默认 `local_exam_admin`） | 仅 `student-guard`；登录为姓名 + 身份证号 |
| `ADMIN_AUTH_MODE=session` | loopback 守卫 + 须有效考官 session（种子 `teacher_admin`） | 同上，与考官模式无关 |

**注意**：`admin-loopback-guard` 与 `admin-guard` 分层——前者管**谁可以连到管理 API**，后者管**是否已登录**（session 模式下）。disabled 模式下后者恒通过，但前者仍阻止 LAN 上的考试机调用 `/api/admin/*`。

## 使用约定

- 新增 `/api/admin/*` 路由：挂载 `preHandler: requireAdminSession`，业务内用 `resolveAdminTeacherId(request)` 取 `teacherId`。
- 新增 `/api/student/*` 需登录路由：挂载 `preHandler: requireStudentSession`（或 `ensureStudentRosterEntryId`）。
- 勿在学员路由使用 `getSessionTeacherId`；勿在管理路由假设学员 session。

# Phase 1 技术研究 — 基础服务与教师认证

**生成日期:** 2026-05-15  
**用途:** 供 `gsd-planner` 制定可执行 PLAN；回答「要把本阶段规划好，还必须搞清什么？」

---

## User Constraints

以下内容来自 `01-CONTEXT.md` 的已锁定决策与边界，**研究结论与 PLAN 不得违背**。

### 教师账号模型（首期）

- **D-01:** 支持 **多名教师**，每人独立账号；**权限平等**（均可管理题库/考试/导出等业务能力，不做复杂 RBAC 树）。
- **D-02:** 首批（或首批之一）管理员账号通过 **数据库迁移种子** 写入；**首次登录强制改密**（禁止长期使用种子默认口令）。
- **D-03:** v1 **不提供**「忘记密码」自助流程；密码找回由 **机房/管理员按运维文档** 处理。
- **D-04:** 登录态采用 **服务端 Session + HttpOnly Cookie**（不用 JWT 承载主会话；若后续有多实例再评估粘性会话或集中 Session 存储）。

### 进程与部署形态

- **D-05:** 对外推荐的标准交付形态为 **Docker Compose**（镜像 + compose，便于换机复现与版本对齐）。
- **D-06:** **不在本阶段锁死**「进程直连 `0.0.0.0`」与「仅本机 + 反向代理」二选一；**部署文档必须同时给出两套验收路径**：(A) 服务绑定 `0.0.0.0:端口` + **Windows 防火墙放行**说明；(B) 服务仅监听本机回环 + **IIS/Nginx** 等反向代理对外（便于在代理层做 TLS）。
- **D-07:** v1 可观测性最小集：**HTTP 健康检查端点**（如 `/health` 或等价路径）+ **控制台日志**。
- **D-08:** 开发与 CI 侧 **优先以 Docker 对齐** 生产行为。

### Planner discretion（讨论未覆盖项）

- HTTPS/TLS 是否在 Phase 1 强制：可在 **反向代理终结 TLS** 或 **内网 HTTP + 网络隔离** 中择一，须在部署文档与威胁建模中写明假设。
- 管理端与学生端 URL 结构：本阶段采用 **同域 + 路径前缀**（见下方推荐栈与 UI-SPEC）。

---

## 推荐技术栈（唯一主线）

以下为绿地仓库的 **默认实现路径**；若执行中发现硬性约束再开 ADR 变更。

| 层级 | 选型 | 说明 |
|------|------|------|
| 仓库布局 | **pnpm monorepo** | `apps/web`（Vite SPA）+ `apps/server`（HTTP API）；根目录 `docker-compose.yml` + 顶层 `README`。 |
| 前端 | **React 19 + TypeScript + Vite 6 + Tailwind CSS v4** | 与 `01-UI-SPEC.md` 一致；**shadcn/ui**（`new-york` / `zinc`）在 Plan 01-01 内 `npx shadcn@latest init`。 |
| 后端 | **Node.js LTS + Fastify 5** | 与前端同语系、生态成熟；便于 Session、Cookie、同源 BFF 式 API。 |
| 数据库 | **PostgreSQL 16** | 单机考场足够；支撑会话表、教师表及后续题库关系；Compose 内官方镜像。 |
| ORM / 迁移 | **Prisma** | `prisma/schema.prisma` + `prisma migrate`；种子用户用 `prisma/seed.ts`。 |
| 会话 | **`express-session` + `connect-pg-simple`**（Fastify 下用 `@fastify/express` 挂载或等价 Fastify 会话存储适配） | 满足 **D-04**；会话落库，**进程重启不丢会话** `[ASSUMED: 常见生产实践]`。若执行期更倾向纯 Fastify 生态，可改为自定义 `express-session` 兼容 store，但须保持 **HttpOnly、Secure（代理 TLS 时）、SameSite** 策略不变。 |
| 密码哈希 | **@node-rs/argon2** 或 **argon2** 包 | 优于 bcrypt 的抗 GPU 特性；种子口令仅存哈希 `[ASSUMED: OWASP 密码存储建议]`。 |
| 反向代理 / 局域网 | **文档化双路径（D-06）** | 不在代码中二选一；Compose 默认暴露应用端口供路径 A；路径 B 写明 `listen 127.0.0.1` + Nginx/IIS 样例片段 `[ASSUMED]`。 |
| 日志与健康 | **`/health` JSON 200** + **pino** 或 Fastify 默认 logger | 满足 **D-07**。 |

**来源标注:** 未单独标注的栈级选择为基于 CONTEXT + UI-SPEC + 局域网考试场景的 **`[ASSUMED]`** 工程判断；包名与主版本在执行前应以 `npm view` / 官方文档核对。

---

## 架构模式

1. **BFF 式 API：** 浏览器只调 `Same-Site` 的 `/api/*`；Session Cookie 仅对 `/api` 与页面路径生效，由服务端统一鉴权。
2. **教师管理端路由：** 严格按 `01-UI-SPEC.md`：`/` 学生占位；`/admin/login`、`/admin/change-password`、`/admin`（或 `/admin/dashboard`）。
3. **首登改密闸门：** Session 中带 `mustChangePassword`（或查库字段）；除改密接口外，其余 `/admin/*` API 与前端路由一律拦截并重定向到改密页（**D-02**）。
4. **未授权访问：** 管理 API 返回 **401**；前端守卫与 UI-SPEC 的 `sessionExpired` / `unauthenticated` 行为一致（**AUTH-01**）。

---

## 勿重复造轮子

| 问题 | 使用 | 不要 |
|------|------|------|
| 表单与可访问性 | shadcn Form + react-hook-form + zod | 手写无 label 的裸 input |
| 密码存储 | argon2 | 明文、可逆加密、自研哈希 |
| 会话 | 服务端 session store + HttpOnly Cookie | 浏览器 localStorage 存 JWT 主会话（违背 D-04） |
| 迁移与种子 | Prisma migrate + seed | 手工 SQL 散落无版本 |
| 登录暴力破解基础防护 | `@fastify/rate-limit` 仅挂在 `/api/auth/login` | 无限制尝试 |

---

## 常见坑

1. **CORS + Cookie：** 开发时若 Vite 端口与 API 端口分离，须配置 `credentials: true` 与精确 `origin`，且 Cookie `SameSite=None` 需 `Secure`（本地常为 HTTPS 或代理）— 生产推荐 **同源**（由同一源站静态 + `/api` 反代）规避 `[ASSUMED]`。
2. **信任代理与 Secure Cookie：** 在反向代理后须启用 `trustProxy`，否则 `Secure` Cookie 与 IP 日志可能错误 `[CITED: Fastify 文档 trustProxy]`。
3. **账号枚举：** 登录失败文案须统一为 UI-SPEC 已定稿，不得区分「用户不存在」与「密码错误」（**AUTH-01** 与隐私）。
4. **Prisma 与连接池：** Compose 内 Postgres 健康检查后再启动 `app`，避免 migrate 竞态 `[ASSUMED]`。
5. **Windows 考场：** 文档中明确防火墙入站规则、端口占用与浏览器同源访问方式（**INFRA-01**）。

---

## ASVS L1 / 威胁建模要点（供各 PLAN `<threat_model>` 引用）

| STRIDE | 本阶段关注点 | 处置方向 |
|--------|----------------|----------|
| Spoofing | 伪造 Cookie / Session | HttpOnly、随机 session id、服务端存储 |
| Tampering | 篡改登录请求/响应 | HTTPS 在代理层或内网隔离声明；body 校验（zod） |
| Repudiation | 登录审计 | 结构化日志记录登录成功/失败（不落明文密码） |
| Information disclosure | 错误消息泄露账号状态 | 统一错误文案（UI-SPEC） |
| Denial of service | 暴力破解 | 登录 rate-limit |
| Elevation | 未登录访问管理 API | 路由级 auth guard + 401 |

---

## 与 UI-SPEC 的对齐

- 所有管理端页面结构、文案、组件清单、无障碍要求 **以 `01-UI-SPEC.md` 为权威**。
- Phase 1 **不展示**「忘记密码」入口（**D-03**）。

---

## RESEARCH 覆盖审计（供 planner source audit）

| 来源 | 条目 | 处理方式 |
|------|------|----------|
| GOAL | 局域网可访问 + 教师登录 + 未授权不可访问 | 拆入 01-01～01-03 |
| REQ | INFRA-01 | 01-01、01-02 |
| REQ | AUTH-01 | 01-03 |
| CONTEXT | D-01～D-08 | 见 User Constraints；PLAN 任务须带 D-xx 追溯 |

---

## RESEARCH COMPLETE

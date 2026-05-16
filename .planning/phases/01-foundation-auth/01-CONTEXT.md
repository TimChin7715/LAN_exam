# Phase 1: 基础服务与教师认证 - Context

**Gathered:** 2026-05-15  
**Status:** Ready for planning

## Phase Boundary

在专用服务器上交付可局域网访问的 Web 应用骨架；完成数据持久化与基础配置；实现 **教师登录**（多名教师、平等权限）、**服务端会话**与 **管理端路由守卫**，使未授权请求无法访问管理功能。对应需求 **INFRA-01**、**AUTH-01**。

## Implementation Decisions

### 教师账号模型（首期）

- **D-01:** 支持 **多名教师**，每人独立账号；**权限平等**（均可管理题库/考试/导出等业务能力，不做复杂 RBAC 树）。
- **D-02:** 首批（或首批之一）管理员账号通过 **数据库迁移种子** 写入；**首次登录强制改密**（禁止长期使用种子默认口令）。
- **D-03:** v1 **不提供**「忘记密码」自助流程；密码找回由 **机房/管理员按运维文档** 处理（改库、重置种子流程或重装等——具体运维步骤在部署文档中写清，不在此锁实现细节）。
- **D-04:** 登录态采用 **服务端 Session + HttpOnly Cookie**（不用 JWT 承载主会话；若后续有多实例再评估粘性会话或集中 Session 存储）。

### 进程与部署形态

- **D-05:** 对外推荐的标准交付形态为 **Docker Compose**（镜像 + compose，便于换机复现与版本对齐）。
- **D-06:** **不在本阶段锁死**「进程直连 `0.0.0.0`」与「仅本机 + 反向代理」二选一；**部署文档必须同时给出两套验收路径**：(A) 服务绑定 `0.0.0.0:端口` + **Windows 防火墙放行**说明；(B) 服务仅监听本机回环 + **IIS/Nginx** 等反向代理对外（便于在代理层做 TLS）。
- **D-07:** v1 可观测性最小集：**HTTP 健康检查端点**（如 `/health` 或等价路径）+ **控制台日志**（结构化与否由实现阶段决定）。
- **D-08:** 开发与 CI 侧 **优先以 Docker 对齐** 生产行为，降低「本机能跑、考场不能跑」的差异。

### 修订（2026-05-17 — 开发启动与教师会话稳定性）

- **D-09:** 根目录 `.env` 统一 **`API_PORT`（默认 3101）** 与 **`WEB_PORT`（默认 5180）**；`apps/web` Vite 从 monorepo 根 `loadEnv`，代理目标与 `apps/server` 的 `getApiPort()` 一致。`pnpm dev` 与 `pnpm dev:web` **均并行启动 API + Web**；仅前端用 `pnpm dev:web-only`，且 Vite 启动时检测 `/health`，API 未就绪时在控制台提示（避免「只起 Web」导致登录/验证报无法连接）。
- **D-10:** 教师会话写入 PostgreSQL 须在变更 `teacherId` 后 **`await saveSession(session)`**（`resave: false` 时不会自动落库）。前端 `GET /api/auth/me`、`POST /api/auth/login|logout|change-password` 使用 **`skipAuthRedirect`**，避免 hydrate/登录流程的 401 触发全局「登录已过期」跳转。`mustChangePassword` 守卫返回 **403** + `PASSWORD_CHANGE_REQUIRED`（**非 401**）。`AuthContext` 仅在**首次** hydrate 显示全屏 checking，后续 `refresh` 不闪回未登录态。

### Planner discretion（讨论未覆盖项）

- **HTTPS/TLS 是否在 Phase 1 强制：** 用户未选择讨论灰区 1；规划/实现时可按 ASVS/校方要求在 **反向代理终结 TLS** 或 **内网 HTTP + 网络隔离** 中择一，但须在部署文档与威胁建模中显式记录假设。
- **管理端与学生端 URL 结构：** 用户未选择讨论灰区 4；`plan-phase` 可提议默认方案（例如同域 `/admin` 前缀 + 根路径占位学生端），并在 `PLAN.md` 中列出替代方案与取舍。

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning and requirements

- `.planning/PROJECT.md` — 产品边界、核心价、约束与演进规则
- `.planning/REQUIREMENTS.md` — INFRA-01、AUTH-01 及全文 REQ-ID
- `.planning/ROADMAP.md` — Phase 1 目标、成功标准、计划包拆分

### External specs

No external specs — requirements fully captured in repository planning files and decisions above.

## Existing Code Insights

### Reusable assets

- 无。仓库为绿地，尚无应用源码；Phase 1 将建立首批可复用模块（路由、会话、配置加载等）。

### Established patterns

- 无既有代码风格约束；与 `.planning/config.json` 中 `security_enforcement` / ASVS 相关设置对齐时，在首版 PLAN 中固化约定。

### Integration points

- Docker Compose 与机房网络（防火墙、代理）的衔接点需在部署文档中写清；应用仅暴露约定端口与健康检查。

## Specific ideas

- 用户明确组合：**多教师 + 种子账号 + 首登改密 + 无自助找回 + Session Cookie**；**Compose 交付 + 双路径部署文档 + health + 开发侧 Docker 优先**。

## Deferred ideas

### 讨论清单中未深入但仍影响实现的项

- **内网 HTTPS/TLS 策略**（原灰区 1）：未在本次讨论中选题；若校方强制 TLS，优先在 **反向代理** 层落地，或在后续里程碑增加应用层 TLS 说明。
- **管理端入口与路由结构**（原灰区 4）：未选题；留给 `plan-phase` 给出默认可实施方案并与 ROADMAP 中 UI hint 对齐。

讨论未引入 Phase 2–4 的新能力；无 folded todos。

---

*Phase: 1-基础服务与教师认证*  
*Context gathered: 2026-05-15*

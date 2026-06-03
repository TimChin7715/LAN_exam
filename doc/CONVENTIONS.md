# 开发约定

## 代码与工具

- **Lint**：以各包现有 TypeScript 编译为准（`pnpm build`）。
- **Test**：`apps/server` 内 `*.test.ts`，Node 内置 `node:test`，在 `apps/server` 目录执行：
  ```bash
  npx tsx --test src/lib/exam/resolve-student-exam-status.test.ts
  npx tsx --test "src/**/*.test.ts"   # 若 shell 支持 glob
  ```
- **Build**：仓库根 `pnpm build`（server tsc + web vite）。

## Git

- **分支**：按仓库现有习惯（发版前更新根目录 `VERSION`）。
- **Commit 风格**：近期多为 `fix(windows,student): …` 或版本里程碑说明；聚焦「为什么」。
- **AI**：不主动 `commit` / `push`，除非用户明确要求。

## 术语（统一）

考官 / 学员 / 管理机 / 身份证号 — 勿用历史「教官」「准考证」表述。

## 测试

- **单测**：`apps/server/src/**/*.test.ts`（exam、fillin、roster 等）。
- **集成**：考场双机、Setup 安装 — 文档化于 `docs/DEPLOY-WINDOWS-NATIVE.md` 与 `INSTALLER_FIXES.md`，非 CI 默认门禁。

## AI 协作偏好

- 最小 diff，不扩 scope；改前先读 `doc/STATE.md` 与 `doc/continue.md`。
- 学员流程勿混入考官 `ADMIN_AUTH_MODE` 逻辑。
- 改 admin 数据范围用 `resolveAdminTeacherId(request)`，勿假设 session 里一定有 `teacherId`。
- 权威代码索引： [../AGENTS.md](../AGENTS.md)（比 `doc/` 更细，随代码更新）。

## 验证命令速查（开发）

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev
curl -sSf http://127.0.0.1:3101/health   # 或生产 5180
```

发版（有网 Windows）：`.\scripts\windows\package.ps1` → `dist\LAN-Exam-Setup-v<VERSION>.exe`。

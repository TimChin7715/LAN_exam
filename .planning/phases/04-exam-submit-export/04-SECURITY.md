---
phase: 04
slug: exam-submit-export
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-16
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 学生浏览器 → `/api/student/exam/*` | 不可信 body；`rosterEntryId` 仅来自 `student_sid` | 作答草稿、examId |
| 学生 → 试卷 JSON | 不得包含 `answerKeys` | 题目 stem/options、已选答案 |
| 教师浏览器 → `/api/admin/exams/*` | 须 `requireAdminSession`；考试 `teacherId` 归属校验 | 成绩、导出、提交明细 |
| POST submit | 计分仅服务端；忽略客户端 totalScore | Submission + Answer 行 |
| GET export | 已登录教师；xlsx 离开系统到本机 | 脱敏身份证号、成绩 |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01-01 | Elevation | exam-paper / exam-answers | mitigate | `assertStudentExamAccess` 校验 `entry.batchId === exam.rosterBatchId` | closed |
| T-04-01-02 | Tampering | exam-answers body | mitigate | 校验 `examQuestionId` 属于 `examId`；`rosterEntryId` 仅 session | closed |
| T-04-01-03 | Information disclosure | exam-paper | mitigate | select 排除 `answerKeys`；403 笼统文案 | closed |
| T-04-01-04 | Tampering | POST start | mitigate | 仅 `DRAFT`；教师 session；同 batch 单 `IN_PROGRESS` | closed |
| T-04-01-05 | Denial of service | PUT answers | mitigate | rateLimit 60/min；zod `answers.length` ≤ 题目数 | closed |
| T-04-02-01 | Tampering | submit | mitigate | `@@unique([examId, rosterEntryId])` + 事务前 `findUnique` | closed |
| T-04-02-02 | Tampering | PUT after submit | mitigate | 已有 Submission 则 409；submit 后 `deleteMany` drafts | closed |
| T-04-02-03 | Repudiation | score | accept | `Answer` 行持久化 `selectedKeys`, `pointsAwarded` | closed |
| T-04-02-04 | Elevation | GET admin submission | mitigate | `findFirst({ where: { id, teacherId } })` | closed |
| T-04-02-05 | Denial of service | POST submit | mitigate | rateLimit 10/min | closed |
| T-04-03-01 | Information disclosure | export xlsx | mitigate | `maskNationalId` 写入汇总/明细列 | closed |
| T-04-03-02 | Elevation | exams-export | mitigate | `requireAdminSession` + `where: { id, teacherId }` | closed |
| T-04-03-03 | Information disclosure | logs | mitigate | 导出/考试路由无 `nationalId` 日志；无 body 级 PII 记录 | closed |
| T-04-03-04 | Denial of service | large export | accept | v1 单考场规模；`writeBuffer`；注释规模上限 ~2000×200 | closed |

*Disposition: mitigate · accept · transfer*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04-02-01 | T-04-02-03 | 服务端计分结果以 `Answer` 行（`selectedKeys`, `pointsAwarded`, `isCorrect`）持久化，满足成绩可追溯；非实时审计链 | gsd-secure-phase | 2026-05-16 |
| R-04-03-01 | T-04-03-04 | v1 单考场导出使用内存 `writeBuffer`；`export-workbook.ts` 注释约定实用上限 ~2000 名单 × ~200 题，超出需流式/分块（后续阶段） | gsd-secure-phase | 2026-05-16 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-16 | 14 | 14 | 0 | gsd-secure-phase (orchestrator) |

### Threat Verification Evidence

| Threat ID | Evidence |
|-----------|----------|
| T-04-01-01 | `access.ts:33-38` batchId vs rosterBatchId；`exam-paper.ts:37`, `exam-answers.ts:51` |
| T-04-01-02 | `exam-answers.ts:35-48` session rosterEntryId；`90-103` examQuestionId 归属校验 |
| T-04-01-03 | `exam-paper.ts:51-68` select 无 answerKeys；`access.ts:17-21,34-37` 笼统 403 |
| T-04-01-04 | `transition.ts:28-34` DRAFT only；`58-72` 单 IN_PROGRESS；`exams-lifecycle.ts:15` requireAdminSession |
| T-04-01-05 | `exam-answers.ts:28-31` rateLimit 60；`62-70` answers.length vs questionCount |
| T-04-02-01 | `schema.prisma` Submission `@@unique([examId, rosterEntryId])`；`submit.ts:15-27` |
| T-04-02-02 | `exam-answers.ts:72-84` 409；`submit.ts:93-95` deleteMany drafts |
| T-04-02-03 | `submit.ts:74-88` Answer create with selectedKeys/pointsAwarded |
| T-04-02-04 | `exams-submissions.ts:21-24,83-86` teacherId match |
| T-04-02-05 | `exam-submit.ts:22-25` rateLimit 10 |
| T-04-03-01 | `export-workbook.ts:99,130` maskNationalId |
| T-04-03-02 | `exams-export.ts:18,27-29` |
| T-04-03-03 | 考试/导出路由无 `request.log` 含 nationalId（仅 DB select 用于 mask） |
| T-04-03-04 | `export-workbook.ts:26-28` 规模注释；`exams-export.ts:41` writeBuffer |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-16

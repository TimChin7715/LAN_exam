# Phase 4 验收说明 — 考试、提交与导出

**阶段：** 04-exam-submit-export  
**更新：** 2026-05-16  
**读者：** 教师验收、运维 smoke

---

## ROADMAP 成功标准（手动核对）

| # | 标准 | 验证步骤 | 通过 |
|---|------|----------|------|
| 1 | 教师创建考试并关联题目与名单后，名单内学生可见试卷并答题 | 导入题库+名单 → 新建考试选两批次 → 开始考试 → 学生 waiting 自动进 take → 可见全部客观题 | [ ] |
| 2 | 学生提交后管理端可见记录；重复提交符合 EXAM-02 | 学生提交 → 管理端成绩表有总分与时间；再次提交 → 409 + 固定中文提示 | [ ] |
| 3 | 导出含汇总与明细，Excel 可打开、中文正常 | 结束考试 → 导出 xlsx → 两工作表「成绩汇总」「答题明细」 | [ ] |

---

## 锁定：考试状态（D-01～D-04）

| 决策 | 验收要点 |
|------|----------|
| D-01 | 三态：`DRAFT` → `IN_PROGRESS` → `ENDED`；`ENDED` 后学生不可保存/提交 |
| D-02 | 仅教师「开始考试」可使 `DRAFT`→`IN_PROGRESS`；学生首次打开 **不会** 自动开考 |
| D-03 | `/exam/waiting` **4s** 轮询（页面 hidden 时暂停）；检测到进行中自动跳转 `/exam/take?examId=` |
| D-04 | 仅教师「结束考试」可使 `IN_PROGRESS`→`ENDED`；**不** 依赖「全员提交」作为唯一收卷方式 |

---

## 需求验收

### EXAM-01 组卷、答题与提交

**组卷（Planner 默认，本阶段锁定）：**

- [ ] 考试关联 **整批** `QuestionImportBatch` 与 **整批** `RosterImportBatch`
- [ ] 创建/编辑（仅 `DRAFT`）时物化 `ExamQuestion`，顺序为批次内题目 `createdAt` 升序
- [ ] 同卷：所有考生同一 `ExamQuestion` 集合
- [ ] 开始考试后不可改批次或题目列表

**学生答题：**

- [ ] `GET /api/student/exam/paper` **不含** `answerKeys`
- [ ] 选项变更约 **2s** 后自动保存（`AnswerDraft`）
- [ ] 非名单批次考生：403「当前无法参加本场考试。」（笼统，不泄露考试是否存在）
- [ ] 同名单批次 **同时仅一场** `IN_PROGRESS` 考试（第二场 start 失败）

**提交（与 04-02 一致）：**

- [ ] 学生可一次性提交；提交后管理端可见该生记录

### EXAM-02 提交后不可篡改与重复提交

| 行为 | 预期 |
|------|------|
| 首次 `POST /api/student/exam/submit` | 200；创建唯一 `Submission`；删除 `AnswerDraft` |
| 再次 submit | **409**；文案「您已提交过本场考试，无法再次提交。」 |
| 已提交后 `PUT .../answers` | **409**（或同等拒绝） |
| 已提交后查看 | `GET /api/student/exam/submission` 只读自己的 `selectedKeys`、对错、得分；**不** 返回标准答案 `answerKeys` |
| 考试 `ENDED` 后 submit/保存 | 拒绝 |

### EXPR-01 成绩汇总导出

**主格式：** 单文件 `.xlsx`（exceljs），工作表 **成绩汇总**。

| 列 | 说明 |
|----|------|
| 姓名 | `RosterEntry.fullName` |
| 身份证号 | **脱敏**（见下表） |
| 总分 | 已提交为整数；**未提交为「—」**（空分 + 未提交标志） |
| 是否提交 | 已提交 / **未提交** |
| 提交时间 | 已提交为 `yyyy-MM-dd HH:mm`；未提交为空 |

- [ ] 名单批次内 **全部** 考生出现在汇总表（含未提交）
- [ ] 导出文件可用 Excel 或 WPS 打开，中文表头无乱码

### EXPR-02 答题明细导出

同一 xlsx 内第二工作表 **答题明细**：

| 列 | 说明 |
|----|------|
| 姓名 | |
| 身份证号 | 脱敏 |
| 题号 | `sortOrder + 1` |
| 题型 | 单选/多选/判断 |
| 所选 | 规范化后选项串 |
| 正确答案 | 来自题库 `answerKeys` |
| 对错 | 是/否 |
| 得分 | 该题 `pointsAwarded` |

- [ ] 仅 **已提交** 考生产生明细行
- [ ] 行数 = 已提交人数 × 题目数（抽样核对）

### 证号脱敏（导出与管理端列表）

| 场景 | 规则 |
|------|------|
| 导出 xlsx / 管理端成绩表 | `maskNationalId`：18 位证号 → 前 6 + `********` + 后 4；非 18 位 → `—` |
| 学生准备页 | 仍显示 **完整** 18 位（Phase 3 D-06，不变） |

- [ ] 导出文件中 **无** 完整 18 位证号列

---

## 计分契约（QBANK-02 — 与 Phase 2 一致）

**权威：** `.planning/phases/02-qbank-import/02-ACCEPTANCE.md`

| 题型 | 规则 |
|------|------|
| `MULTI` + `ALL_OR_NOTHING` | 所选集合与 `answerKeys` **完全一致** → 得 `points`；否则 **0** |
| `SINGLE` / `JUDGE` | 规范化后字符串 **相等** → 得 `points`；否则 **0** |

- [ ] 计分在 **服务端提交事务** 内完成，使用 `normalize-answer.ts` + `score-question.ts`
- [ ] 多选 `A,B` 与 `B,A` 导入等价、计分等价（`splitAnswerTokens` + sort）

**建议自动化：** `node --import tsx --test apps/server/src/lib/exam/score-question.test.ts`

---

## 作答保存（Planner 默认）

- [ ] `AnswerDraft` 表持久化；非 localStorage
- [ ] 提交前可修改选项；提交后不可

---

## 威胁假设（内网 ASVS L1）

- 试卷 API 不返回答案键，降低泄题
- 导出需教师 session；日志不打印完整证号
- 学生 API 不信任 body 中的 `rosterEntryId`

---

## 建议 smoke 路径

1. 教师：导入题库 + 名单 → `/admin/exams` 新建考试 → **开始考试**
2. 学生：登录 → waiting 自动进 take → 作答 → **提交试卷**
3. 教师：成绩表见提交记录 → **结束考试** → **导出成绩与明细**
4. 学生：再次提交 → 409；打开 xlsx 核对汇总/明细/脱敏
5. 运行 `score-question.test.ts`

---

## Phase 3 消费核对

- [ ] 学生 session 使用 `studentRosterEntryId`（非 body）
- [ ] 准入校验 `RosterEntry.batchId === Exam.rosterBatchId`

---

*Phase 4 计划：04-01 实体与作答 → 04-02 提交计分 → 04-03 导出*

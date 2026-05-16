---
created: 2026-05-16T15:23:42.072Z
title: Add back link to AdminExams page
area: ui
files:
  - apps/web/src/pages/AdminExams.tsx:115-123
  - apps/web/src/pages/AdminQuestions.tsx:136-141
  - .planning/phases/04-exam-submit-export/04-UI-SPEC.md:63-64
---

## Problem

教师管理端「考试管理」页（`/admin/exams`，`AdminExams.tsx`）页头缺少返回入口。用户只能依赖浏览器后退或退出登录，无法回到仪表盘。

同项目的「题库管理」「名单管理」页已有「← 返回仪表盘」链接（`Link to="/admin"`）。Phase 04 的 `04-UI-SPEC.md` 与 `04-PATTERNS.md` 也要求 `AdminExams` 采用相同页壳，但实现时未加上该链接。

## Solution

在 `AdminExams.tsx` 页头标题上方添加与 `AdminQuestions.tsx` / `AdminRoster.tsx` 一致的返回链接：

```tsx
<Link
  to="/admin"
  className="inline-block text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
>
  ← 返回仪表盘
</Link>
```

将现有 `flex` 页头调整为 `space-y-2` 块结构（参考 `04-PATTERNS.md` 中 `AdminRoster` 页壳），「新建考试」按钮保留在标题行右侧。

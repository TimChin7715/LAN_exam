import { useMemo } from 'react';

import type {
  AnswerProgressRow,
  AnswerProgressSection,
  AnswerProgressSummary,
} from '@/lib/exam-submit-validation';
import {
  hasExamModule,
  needsFillIn,
  type ExamContentModule,
} from '@/lib/student';
import { FILL_MODULE_LABEL } from '@/lib/content-module-labels';
import { cn } from '@/lib/utils';

const SECTION_ORDER: AnswerProgressSection[] = ['objective', 'fill'];

const SECTION_LABELS: Record<AnswerProgressSection, string> = {
  objective: '客观题',
  fill: FILL_MODULE_LABEL,
};

function sectionVisible(
  section: AnswerProgressSection,
  contentModules: ExamContentModule[],
): boolean {
  if (section === 'objective') {
    return hasExamModule(contentModules, 'OBJECTIVE');
  }
  return needsFillIn(contentModules);
}

function QuestionNavButton({
  row,
  onQuestionClick,
}: {
  row: AnswerProgressRow;
  onQuestionClick: (key: string) => void;
}) {
  const statusText = row.answered ? '已作答' : '未作答';
  return (
    <button
      type="button"
      title={`${row.label}（${statusText}）`}
      aria-label={`${row.label}，${statusText}，点击跳转`}
      onClick={() => onQuestionClick(row.key)}
      className={cn(
        'inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-1.5 text-sm leading-none font-semibold tabular-nums transition-colors',
        'hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        row.answered
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground ring-1 ring-border',
      )}
    >
      {row.circleLabel}
    </button>
  );
}

type StudentExamAnswerOverviewProps = {
  summary: AnswerProgressSummary;
  contentModules: ExamContentModule[];
  onQuestionClick: (key: string) => void;
};

export function StudentExamAnswerOverview({
  summary,
  contentModules,
  onQuestionClick,
}: StudentExamAnswerOverviewProps) {
  const groupedRows = useMemo(() => {
    const groups = new Map<AnswerProgressSection, AnswerProgressRow[]>();
    for (const section of SECTION_ORDER) {
      if (!sectionVisible(section, contentModules)) continue;
      const rows = summary.rows.filter((row) => row.section === section);
      if (rows.length > 0) {
        groups.set(section, rows);
      }
    }
    return groups;
  }, [contentModules, summary.rows]);

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-muted/20"
      role="region"
      aria-label="考试情况概览"
    >
      <div className="shrink-0 border-b border-border px-3 py-3">
        <h2 className="text-sm font-semibold leading-tight text-foreground">
          考试情况
        </h2>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          已作答 {summary.answeredCount} / {summary.totalCount}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-3 py-3">
        {[...groupedRows.entries()].map(([section, rows]) => (
          <section key={section} aria-label={SECTION_LABELS[section]}>
            <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
              {SECTION_LABELS[section]}
            </h3>
            <div className="flex flex-wrap gap-2">
              {rows.map((row) => (
                <QuestionNavButton
                  key={row.key}
                  row={row}
                  onQuestionClick={onQuestionClick}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

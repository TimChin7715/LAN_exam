import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type {
  AnswerProgressRow,
  AnswerProgressSection,
  AnswerProgressSummary,
} from '@/lib/exam-submit-validation';
import {
  hasExamModule,
  needsFillIn,
  needsPractical,
  type ExamContentModule,
} from '@/lib/student';
import { cn } from '@/lib/utils';

const SECTION_ORDER: AnswerProgressSection[] = [
  'objective',
  'fill',
  'practical',
];

const SECTION_LABELS: Record<AnswerProgressSection, string> = {
  objective: '客观题',
  fill: '填空题',
  practical: '操作题',
};

function sectionVisible(
  section: AnswerProgressSection,
  contentModules: ExamContentModule[],
): boolean {
  if (section === 'objective') {
    return hasExamModule(contentModules, 'OBJECTIVE');
  }
  if (section === 'fill') {
    return needsFillIn(contentModules);
  }
  return needsPractical(contentModules);
}


function QuestionCircle({ row }: { row: AnswerProgressRow }) {
  const statusText = row.answered ? '已作答' : '未作答';
  return (
    <span
      title={`${row.label}（${statusText}）`}
      aria-label={`${row.label}，${statusText}`}
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[0.625rem] leading-none font-medium tabular-nums sm:size-4.5 sm:text-[0.6875rem]',
        row.answered
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground ring-1 ring-border',
      )}
    >
      {row.circleLabel}
    </span>
  );
}

type StudentExamAnswerOverviewProps = {
  summary: AnswerProgressSummary;
  contentModules: ExamContentModule[];
  readOnly?: boolean;
};

export function StudentExamAnswerOverview({
  summary,
  contentModules,
}: StudentExamAnswerOverviewProps) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expanded]);

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

  const summaryLine = (
    <span className="text-xs tabular-nums text-muted-foreground">
      {summary.answeredCount}/{summary.totalCount}
    </span>
  );

  if (!expanded) {
    return (
      <div className="fixed top-0 left-0 z-40 p-3 sm:p-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 bg-background/95 shadow-md backdrop-blur-sm"
          aria-expanded={false}
          aria-label={`展开考试情况概览，已作答 ${summary.answeredCount} 题，共 ${summary.totalCount} 题`}
          onClick={() => setExpanded(true)}
        >
          <span className="text-sm font-medium">考试情况</span>
          {summaryLine}
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 left-0 z-40 p-3 sm:p-4"
      role="region"
      aria-label="考试情况概览"
    >
      <div className="flex aspect-square w-[min(calc(100vw-1.5rem),13.5rem)] flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-lg backdrop-blur-sm">
        <div className="flex shrink-0 items-center justify-between gap-1 border-b border-border px-2.5 py-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight text-foreground">
              考试情况
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              已作答 {summary.answeredCount} / {summary.totalCount}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-expanded={true}
            aria-label="收起考试情况概览"
            onClick={() => setExpanded(false)}
          >
            <ChevronUp className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-2 py-2">
          {[...groupedRows.entries()].map(([section, rows]) => (
            <section key={section} aria-label={SECTION_LABELS[section]}>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                {SECTION_LABELS[section]}
              </h3>
              <div className="flex flex-wrap gap-1">
                {rows.map((row) => (
                  <QuestionCircle key={row.key} row={row} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StudentExamQuestionStepperProps = {
  currentIndex: number;
  totalCount: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
  offsetForSidebar?: boolean;
};

export function StudentExamQuestionStepper({
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
  className,
  offsetForSidebar = false,
}: StudentExamQuestionStepperProps) {
  const atFirst = currentIndex <= 0;
  const atLast = currentIndex >= totalCount - 1;

  return (
    <div
      className={cn(
        'fixed bottom-4 z-40 flex items-center gap-2 rounded-lg border border-border bg-background/95 p-1.5 shadow-md backdrop-blur',
        offsetForSidebar
          ? 'right-4 md:right-[calc(15rem+1rem)]'
          : 'right-4',
        className,
      )}
      role="navigation"
      aria-label="题目切换"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1 px-2.5"
        disabled={atFirst}
        onClick={onPrevious}
      >
        <ChevronLeft className="size-4" aria-hidden />
        上一题
      </Button>
      <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-muted-foreground">
        {currentIndex + 1}/{totalCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1 px-2.5"
        disabled={atLast}
        onClick={onNext}
      >
        下一题
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

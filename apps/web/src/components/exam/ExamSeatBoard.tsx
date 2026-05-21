import type { SeatBoardItem } from '@/lib/exam';

export type ExamSeatBoardProps = {
  title?: string;
  cols: number;
  rows: number;
  items: SeatBoardItem[];
  compact?: boolean;
};

export function ExamSeatBoard({
  title,
  cols,
  items,
  compact = false,
}: ExamSeatBoardProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        暂无考生座位信息
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title ? (
        <p className="text-sm font-medium text-foreground">{title}</p>
      ) : null}
      <div
        className={`rounded-lg border border-border bg-muted/30 p-2 ${compact ? 'max-h-[320px] overflow-y-auto' : 'max-h-[480px] overflow-y-auto'}`}
      >
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item, index) => (
            <div
              key={`${item.seatLabel}-${index}`}
              className={`flex min-h-[2.75rem] flex-col items-center justify-center rounded border border-border bg-background px-0.5 py-1 text-center ${compact ? 'min-h-[2.25rem]' : ''}`}
              title={`${item.fullName} · 座位 ${item.seatLabel}`}
            >
              <span className="w-full truncate text-[10px] font-medium leading-tight text-foreground">
                {item.fullName}
              </span>
              <span className="w-full truncate text-[9px] leading-tight text-muted-foreground">
                座位 {item.seatLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

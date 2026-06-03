import { useEffect, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ExamSeatBoard } from '@/components/exam/ExamSeatBoard';
import { studentSeatStatusLabel } from '@/lib/seat-status';
import type { ExamSeatBoard as AdminSeatBoard } from '@/lib/exam';
import {
  fetchStudentSeatBoards,
  type StudentSeatBoard,
} from '@/lib/student';

type ExamSeatBoardPanelProps = {
  mode: 'admin';
  board: AdminSeatBoard | null;
  loading?: boolean;
  error?: string | null;
};

type StudentPanelProps = {
  mode: 'student';
};

export function ExamSeatBoardPanel(
  props: ExamSeatBoardPanelProps | StudentPanelProps,
) {
  if (props.mode === 'admin') {
    return <AdminSeatPanel {...props} />;
  }
  return <StudentSeatPanel />;
}

function AdminSeatPanel({
  board,
  loading = false,
  error = null,
}: ExamSeatBoardPanelProps) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">{error}</p>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">考生座位</h3>
      <ExamSeatBoard
        cols={board.cols}
        rows={board.rows}
        items={board.items}
      />
    </div>
  );
}

function StudentSeatPanel() {
  const [boards, setBoards] = useState<StudentSeatBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchStudentSeatBoards();
        if (!cancelled) setBoards(data);
      } catch {
        if (!cancelled) {
          setError('无法加载座位信息，请稍后刷新页面。');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <CardShell>
        <div className="flex min-h-[200px] items-center justify-center">
          <Spinner />
        </div>
      </CardShell>
    );
  }

  if (error) {
    return (
      <CardShell>
        <p className="text-sm text-destructive">{error}</p>
      </CardShell>
    );
  }

  if (boards.length === 0) {
    return (
      <CardShell>
        <h3 className="text-base font-semibold text-foreground">考生座位</h3>
        <p className="text-sm text-muted-foreground">
          当前没有未开始或进行中的考试，暂无座位信息。
        </p>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <h3 className="text-base font-semibold text-foreground">考生座位</h3>
      {boards.length > 1 ? (
        <p className="mb-3 text-sm text-muted-foreground">
          当前有多场考试，请根据监考安排确认对应座位。
        </p>
      ) : null}
      <div className="space-y-6">
        {boards.map((board) => (
          <div key={board.examId} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{board.title}</p>
              <Badge variant="secondary">
                {studentSeatStatusLabel(board.displayStatus)}
              </Badge>
            </div>
            <ExamSeatBoard
              cols={board.cols}
              rows={board.rows}
              items={board.items}
              compact
            />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0 flex-1 rounded-xl border border-border bg-card p-4 shadow-sm lg:max-w-[520px]">
      {children}
    </div>
  );
}

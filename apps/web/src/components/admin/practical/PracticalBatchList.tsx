import { BookOpen } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PracticalBatchListItem } from '@/lib/practical';

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type PracticalBatchListProps = {
  batches: PracticalBatchListItem[];
  loading: boolean;
  error: string | null;
  deletingId: string | null;
  onRetry: () => void;
  onDelete: (id: string) => void;
};

export function PracticalBatchList({
  batches,
  loading,
  error,
  deletingId,
  onRetry,
  onDelete,
}: PracticalBatchListProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {error}
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            重试
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Spinner className="size-5" />
        <span>加载操作题库列表…</span>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <BookOpen className="size-10 text-muted-foreground" aria-hidden />
        <h3 className="text-xl font-semibold text-foreground">暂无操作题库</h3>
        <p className="max-w-md text-base text-muted-foreground">
          请上传 Word 试卷与 Excel/CSV 附件，每次导入将生成一个操作题库。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">文件名</TableHead>
            <TableHead scope="col">上传时间</TableHead>
            <TableHead scope="col" className="w-40">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell className="max-w-md">
                <p className="font-medium">{batch.wordFileName}</p>
                <p className="text-sm text-muted-foreground">{batch.excelFileName}</p>
              </TableCell>
              <TableCell>{formatImportedAt(batch.createdAt)}</TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="link"
                      className="min-h-11 px-0 text-destructive"
                      disabled={deletingId === batch.id}
                    >
                      删除
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除操作题库？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将永久删除「{batch.title}」及已存储的文件，此操作不可恢复。已结束或未开始的考试将自动解除关联；进行中的考试须先结束。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onDelete(batch.id)}
                      >
                        删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

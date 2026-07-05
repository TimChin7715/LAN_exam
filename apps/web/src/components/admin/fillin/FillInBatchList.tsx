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
import { adminEmptyTitle, adminMeta } from '@/components/admin/admin-typography';
import {
  AdminDataTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/admin/AdminPagePrimitives';
import { Spinner } from '@/components/ui/spinner';
import type { FillInBatchListItem } from '@/lib/fillin';
import { cn } from '@/lib/utils';

type FillInBatchListProps = {
  batches: FillInBatchListItem[];
  loading: boolean;
  error: string | null;
  deletingId: string | null;
  onRetry?: () => void;
  onDelete: (id: string) => void;
};

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FillInBatchList({
  batches,
  loading,
  error,
  deletingId,
  onRetry,
  onDelete,
}: FillInBatchListProps) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {error}
          {onRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              重试
            </Button>
          ) : null}
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
        <h3 className={adminEmptyTitle}>暂无操作题库</h3>
        <p className={cn('max-w-2xl', adminMeta)}>
          请先下载 Word 模板，在文档中用【标准答案】（分值）标记空位，例如【北京|北平】（2分）。考试端将展示完整 Word 排版与图片。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <AdminDataTable>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">文件名</TableHead>
            <TableHead scope="col">题目数</TableHead>
            <TableHead scope="col">上传时间</TableHead>
            <TableHead scope="col" className="w-40">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="max-w-md">
                <p className="font-medium">{b.title || b.wordFileName}</p>
                {b.excelFileName ? (
                  <p className={adminMeta}>Excel：{b.excelFileName}</p>
                ) : (
                  <p className={adminMeta}>{b.wordFileName}</p>
                )}
              </TableCell>
              <TableCell>{b.itemCount}</TableCell>
              <TableCell>{formatImportedAt(b.createdAt)}</TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="link"
                      className="min-h-11 px-0 text-destructive"
                      disabled={deletingId === b.id}
                    >
                      删除
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除操作题库？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将永久删除「{b.title}」及其中的 {b.itemCount}{' '}
                        道题目，此操作不可恢复。已结束或未开始的考试将自动解除关联；进行中的考试须先结束。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onDelete(b.id)}
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
      </AdminDataTable>
    </div>
  );
}

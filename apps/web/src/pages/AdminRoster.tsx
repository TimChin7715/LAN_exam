import { useCallback, useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { ImportDropzone } from '@/components/admin/roster/ImportDropzone';
import { ImportErrorTable } from '@/components/admin/roster/ImportErrorTable';
import { ImportResultSummary } from '@/components/admin/roster/ImportResultSummary';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiLoadErrorMessage } from '@/lib/api';
import {
  deleteRosterBatch,
  fetchRosterBatches,
  RosterBatchInUseError,
  type ImportFailure,
  type ImportSuccess,
  type RosterBatchListItem,
} from '@/lib/roster';

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminRoster() {
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const [importSuccess, setImportSuccess] = useState<ImportSuccess | null>(null);
  const [importFailure, setImportFailure] = useState<ImportFailure | null>(null);
  const [batches, setBatches] = useState<RosterBatchListItem[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    setListError(null);
    try {
      const items = await fetchRosterBatches();
      setBatches(items);
    } catch (err) {
      setListError(getApiLoadErrorMessage(err));
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  function handleImportSuccess(result: ImportSuccess) {
    setImportFailure(null);
    setImportSuccess(result);
    toast.success(`已成功导入 ${result.importedCount} 名考生。`);
    void loadBatches();
    listRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleImportFailure(result: ImportFailure) {
    setImportSuccess(null);
    setImportFailure(result);
    toast.error('导入失败，请查看错误说明并修正文件。');
  }

  function handleViewBatch(batchId: string) {
    navigate(`/admin/roster/${batchId}`);
  }

  async function handleDeleteBatch(id: string) {
    setDeletingId(id);
    try {
      await deleteRosterBatch(id);
      toast.success('名单已删除。');
      void loadBatches();
    } catch (err) {
      if (err instanceof RosterBatchInUseError) {
        const titles = err.examTitles;
        const hint =
          titles.length > 0
            ? `已被考试「${titles.join('」「')}」使用`
            : '已被考试使用';
        toast.error(`无法删除：该名单${hint}。`);
      } else {
        toast.error('删除失败，请稍后重试。');
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/admin"
          className="inline-block text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← 返回仪表盘
        </Link>
        <h1 className="text-xl font-semibold leading-tight text-foreground">
          名单管理
        </h1>
        <p className="text-base text-muted-foreground">
          每次上传一个 Excel 文件将生成一份独立名单。请使用官方模板批量导入，姓名与身份证号须与证件一致（除首尾空格外须完全一致）。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">导入名单</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportDropzone
            onSuccess={handleImportSuccess}
            onFailure={handleImportFailure}
          />
        </CardContent>
      </Card>

      {importSuccess ? (
        <ImportResultSummary
          result={importSuccess}
          onViewBatch={handleViewBatch}
        />
      ) : null}

      {importFailure ? (
        <ImportErrorTable errors={importFailure.errors} />
      ) : null}

      <Card ref={listRef}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">已上传名单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {listError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center gap-3">
                {listError}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadBatches()}
                >
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {loadingBatches ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Spinner className="size-5" />
              <span>加载名单列表…</span>
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Users className="size-10 text-muted-foreground" aria-hidden />
              <h3 className="text-xl font-semibold text-foreground">暂无名单</h3>
              <p className="max-w-md text-base text-muted-foreground">
                请先下载模板并导入 Excel 文件，每次导入将生成一份名单。
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">文件名</TableHead>
                    <TableHead scope="col">人数</TableHead>
                    <TableHead scope="col">上传时间</TableHead>
                    <TableHead scope="col" className="w-40">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="max-w-md font-medium">
                        {batch.fileName}
                      </TableCell>
                      <TableCell>{batch.itemCount}</TableCell>
                      <TableCell>{formatImportedAt(batch.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="link"
                            className="min-h-11 px-0"
                            onClick={() => handleViewBatch(batch.id)}
                          >
                            查看
                          </Button>
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
                                <AlertDialogTitle>确认删除名单？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  将永久删除「{batch.fileName}」及其中的 {batch.itemCount}{' '}
                                  名考生，此操作不可恢复。已被考试引用的名单无法删除。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => void handleDeleteBatch(batch.id)}
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { ImportDropzone } from '@/components/admin/qbank/ImportDropzone';
import { ImportErrorTable } from '@/components/admin/qbank/ImportErrorTable';
import { ImportResultSummary } from '@/components/admin/qbank/ImportResultSummary';
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
  deleteQuestionBank,
  fetchQuestionBanks,
  QuestionBankInUseError,
  type ImportFailure,
  type ImportSuccess,
  type QuestionBankListItem,
} from '@/lib/qbank';

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminQuestions() {
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const [importSuccess, setImportSuccess] = useState<ImportSuccess | null>(null);
  const [importFailure, setImportFailure] = useState<ImportFailure | null>(null);
  const [banks, setBanks] = useState<QuestionBankListItem[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBanks = useCallback(async () => {
    setLoadingBanks(true);
    setListError(null);
    try {
      const items = await fetchQuestionBanks();
      setBanks(items);
    } catch (err) {
      setListError(getApiLoadErrorMessage(err));
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  useEffect(() => {
    void loadBanks();
  }, [loadBanks]);

  function handleImportSuccess(result: ImportSuccess) {
    setImportFailure(null);
    setImportSuccess({ ...result, fileName: result.fileName });
    toast.success(`已成功导入 ${result.importedCount} 道题目。`);
    void loadBanks();
    listRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleImportFailure(result: ImportFailure) {
    setImportSuccess(null);
    setImportFailure(result);
    toast.error('导入失败，请查看错误说明并修正文件。');
  }

  function handleViewBank(batchId: string) {
    navigate(`/admin/questions/${batchId}`);
  }

  async function handleDeleteBank(id: string) {
    setDeletingId(id);
    try {
      await deleteQuestionBank(id);
      toast.success('题库已删除。');
      void loadBanks();
    } catch (err) {
      if (err instanceof QuestionBankInUseError) {
        const titles = err.examTitles;
        const hint =
          titles.length > 0
            ? `已被考试「${titles.join('」「')}」使用`
            : '已被考试使用';
        toast.error(`无法删除：该题库${hint}。`);
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
          题库管理
        </h1>
        <p className="text-base text-muted-foreground">
          每次上传一个 Excel 文件将生成一个独立题库。请使用官方模板批量导入单选、多选与判断题。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">导入题库</CardTitle>
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
          onViewBank={handleViewBank}
        />
      ) : null}

      {importFailure ? (
        <ImportErrorTable errors={importFailure.errors} />
      ) : null}

      <Card ref={listRef}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">已上传题库</CardTitle>
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
                  onClick={() => void loadBanks()}
                >
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {loadingBanks ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Spinner className="size-5" />
              <span>加载题库列表…</span>
            </div>
          ) : banks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <BookOpen className="size-10 text-muted-foreground" aria-hidden />
              <h3 className="text-xl font-semibold text-foreground">暂无题库</h3>
              <p className="max-w-md text-base text-muted-foreground">
                请先下载模板并导入 Excel 文件，每次导入将生成一个题库。
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
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
                  {banks.map((bank) => (
                    <TableRow key={bank.id}>
                      <TableCell className="max-w-md font-medium">
                        {bank.fileName}
                      </TableCell>
                      <TableCell>{bank.itemCount}</TableCell>
                      <TableCell>{formatImportedAt(bank.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="link"
                            className="min-h-11 px-0"
                            onClick={() => handleViewBank(bank.id)}
                          >
                            查看
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="link"
                                className="min-h-11 px-0 text-destructive"
                                disabled={deletingId === bank.id}
                              >
                                删除
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除题库？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  将永久删除「{bank.fileName}」及其中的 {bank.itemCount}{' '}
                                  道题目，此操作不可恢复。已被考试引用的题库无法删除。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => void handleDeleteBank(bank.id)}
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

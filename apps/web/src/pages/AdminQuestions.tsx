import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { adminEmptyTitle, adminMeta } from '@/components/admin/admin-typography';
import {
  AdminDataTable,
  AdminPageHeader,
  AdminSectionCard,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/admin/AdminPagePrimitives';
import { FillInBatchList } from '@/components/admin/fillin/FillInBatchList';
import { FillInImportForm } from '@/components/admin/fillin/FillInImportForm';
import { FillInImportResultSummary } from '@/components/admin/fillin/FillInImportResultSummary';
import { ImportErrorTable } from '@/components/admin/qbank/ImportErrorTable';
import { ImportDropzone } from '@/components/admin/qbank/ImportDropzone';
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
import { Spinner } from '@/components/ui/spinner';
import { getApiLoadErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  deleteQuestionBank,
  fetchQuestionBanks,
  QuestionBankInUseError,
  type ImportFailure,
  type ImportSuccess,
  type QuestionBankListItem,
} from '@/lib/qbank';
import {
  deleteFillInBatch,
  fetchFillInBatches,
  FillInBatchInUseError,
  type FillInBatchListItem,
  type FillInImportFailure,
  type FillInImportSuccess,
} from '@/lib/fillin';

type TabKey = 'objective' | 'fillin';

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminQuestions() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('objective');
  const listRef = useRef<HTMLDivElement>(null);
  const fillInListRef = useRef<HTMLDivElement>(null);
  const [importSuccess, setImportSuccess] = useState<ImportSuccess | null>(null);
  const [importFailure, setImportFailure] = useState<ImportFailure | null>(null);
  const [banks, setBanks] = useState<QuestionBankListItem[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fillInBatches, setFillInBatches] = useState<FillInBatchListItem[]>([]);
  const [loadingFillIn, setLoadingFillIn] = useState(false);
  const [fillInListError, setFillInListError] = useState<string | null>(null);
  const [deletingFillInId, setDeletingFillInId] = useState<string | null>(null);
  const [fillInImportSuccess, setFillInImportSuccess] =
    useState<FillInImportSuccess | null>(null);
  const [fillInImportFailure, setFillInImportFailure] =
    useState<FillInImportFailure | null>(null);

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

  const loadFillInBatches = useCallback(async () => {
    setLoadingFillIn(true);
    setFillInListError(null);
    try {
      setFillInBatches(await fetchFillInBatches());
    } catch (err) {
      setFillInListError(getApiLoadErrorMessage(err));
    } finally {
      setLoadingFillIn(false);
    }
  }, []);

  useEffect(() => {
    void loadBanks();
    void loadFillInBatches();
  }, [loadBanks, loadFillInBatches]);

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

  function handleFillInImportSuccess(result: FillInImportSuccess) {
    setFillInImportFailure(null);
    setFillInImportSuccess(result);
    toast.success(`已成功导入 ${result.importedCount} 道操作题。`);
    void loadFillInBatches();
    fillInListRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleFillInImportFailure(result: FillInImportFailure) {
    setFillInImportSuccess(null);
    setFillInImportFailure(result);
    toast.error('导入失败，请查看错误说明并修正文件。');
  }

  async function handleDeleteFillIn(id: string) {
    setDeletingFillInId(id);
    try {
      await deleteFillInBatch(id);
      toast.success('操作题批次已删除。');
      void loadFillInBatches();
    } catch (err) {
      if (err instanceof FillInBatchInUseError) {
        toast.error(err.message);
      } else {
        toast.error('删除失败，请稍后重试。');
      }
    } finally {
      setDeletingFillInId(null);
    }
  }

  async function handleDeleteBank(id: string) {
    setDeletingId(id);
    try {
      await deleteQuestionBank(id);
      toast.success('题库已删除。');
      void loadBanks();
    } catch (err) {
      if (err instanceof QuestionBankInUseError) {
        toast.error(err.message);
      } else {
        toast.error('删除失败，请稍后重试。');
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader title="题库管理" />
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={tab === 'objective' ? 'default' : 'outline'}
          onClick={() => setTab('objective')}
        >
          客观题
        </Button>
        <Button
          type="button"
          variant={tab === 'fillin' ? 'default' : 'outline'}
          onClick={() => setTab('fillin')}
        >
          操作题
        </Button>
      </div>

      {tab === 'objective' ? (
        <>
          <AdminSectionCard title="导入客观题">
            <ImportDropzone
              onSuccess={handleImportSuccess}
              onFailure={handleImportFailure}
            />
          </AdminSectionCard>

          {importSuccess ? (
            <ImportResultSummary
              result={importSuccess}
              onViewBank={handleViewBank}
            />
          ) : null}

          {importFailure ? (
            <ImportErrorTable errors={importFailure.errors} />
          ) : null}

          <div ref={listRef}>
            <AdminSectionCard title="已上传客观题库" contentClassName="space-y-4">
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
                  <h3 className={adminEmptyTitle}>暂无题库</h3>
                  <p className={cn('max-w-2xl', adminMeta)}>
                    请先下载模板并导入 Excel 文件，每次导入将生成一个题库。
                  </p>
                </div>
              ) : (
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
                                      将永久删除「{bank.fileName}」及其中的{' '}
                                      {bank.itemCount}{' '}
                                      道题目，此操作不可恢复。已被考试引用的题库无法删除，以免影响考后成绩导出。
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
                  </AdminDataTable>
                </div>
              )}
            </AdminSectionCard>
          </div>
        </>
      ) : (
        <>
          <AdminSectionCard title="导入操作题">
            <FillInImportForm
              onSuccess={handleFillInImportSuccess}
              onFailure={handleFillInImportFailure}
            />
          </AdminSectionCard>

          {fillInImportSuccess ? (
            <FillInImportResultSummary
              result={fillInImportSuccess}
              onDismiss={() => setFillInImportSuccess(null)}
            />
          ) : null}

          {fillInImportFailure ? (
            <ImportErrorTable errors={fillInImportFailure.errors} />
          ) : null}

          <div ref={fillInListRef}>
            <AdminSectionCard title="已上传操作题库" contentClassName="space-y-4">
              <FillInBatchList
                batches={fillInBatches}
                loading={loadingFillIn}
                error={fillInListError}
                deletingId={deletingFillInId}
                onRetry={() => void loadFillInBatches()}
                onDelete={(id) => void handleDeleteFillIn(id)}
              />
            </AdminSectionCard>
          </div>
        </>
      )}
    </div>
  );
}

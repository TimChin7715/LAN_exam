import { useCallback, useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { ImportDropzone } from '@/components/admin/roster/ImportDropzone';
import { ImportErrorTable } from '@/components/admin/roster/ImportErrorTable';
import { ImportResultSummary } from '@/components/admin/roster/ImportResultSummary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchRosterList,
  maskNationalId,
  type ImportFailure,
  type ImportSuccess,
  type RosterListItem,
} from '@/lib/roster';

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminRoster() {
  const [importSuccess, setImportSuccess] = useState<ImportSuccess | null>(null);
  const [importFailure, setImportFailure] = useState<ImportFailure | null>(null);
  const [items, setItems] = useState<RosterListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadList = useCallback(
    async (targetPage = page, query = activeQuery) => {
      setLoadingList(true);
      setListError(null);
      try {
        const data = await fetchRosterList({
          page: targetPage,
          pageSize,
          query: query || undefined,
        });
        setItems(data.items);
        setTotal(data.total);
        setPage(data.page);
      } catch {
        setListError('无法连接服务器，请检查网络或联系机房管理员。');
      } finally {
        setLoadingList(false);
      }
    },
    [page, pageSize, activeQuery],
  );

  useEffect(() => {
    void loadList(page);
  }, [loadList, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasQuery = activeQuery.length > 0;
  const isEmpty = !loadingList && !listError && items.length === 0;

  function handleImportSuccess(result: ImportSuccess) {
    setImportFailure(null);
    setImportSuccess(result);
    toast.success(`已成功导入 ${result.importedCount} 名考生。`);
    setPage(1);
    void loadList(1, activeQuery);
  }

  function handleImportFailure(result: ImportFailure) {
    setImportSuccess(null);
    setImportFailure(result);
    toast.error('导入失败，请查看错误说明并修正文件。');
  }

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchInput.trim();
    setActiveQuery(q);
    setPage(1);
    void loadList(1, q);
  }

  function clearSearch() {
    setSearchInput('');
    setActiveQuery('');
    setPage(1);
    void loadList(1, '');
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
          请使用官方 Excel 模板批量导入考生名单。导入前可下载模板，姓名与身份证号须与证件一致（除首尾空格外须完全一致）。
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

      {importSuccess ? <ImportResultSummary result={importSuccess} /> : null}

      {importFailure ? <ImportErrorTable errors={importFailure.errors} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">名单列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={handleSearch}
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="按姓名或身份证号搜索"
              className="min-h-11 flex-1"
              aria-label="搜索名单"
            />
            <div className="flex gap-2">
              <Button type="submit" className="min-h-11">
                搜索
              </Button>
              {searchInput || activeQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={clearSearch}
                >
                  <X className="size-4 sm:mr-1" aria-hidden />
                  清空
                </Button>
              ) : null}
            </div>
          </form>

          {listError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center gap-3">
                {listError}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadList(page)}
                >
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {loadingList ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Spinner className="size-5" />
              <span>加载名单…</span>
            </div>
          ) : isEmpty && !hasQuery ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Users className="size-10 text-muted-foreground" aria-hidden />
              <h3 className="text-xl font-semibold text-foreground">暂无名单</h3>
              <p className="max-w-md text-base text-muted-foreground">
                请先下载模板并导入 Excel 文件。导入成功后考生将显示在下方列表中。
              </p>
            </div>
          ) : isEmpty && hasQuery ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <h3 className="text-xl font-semibold text-foreground">
                未找到匹配记录
              </h3>
              <p className="text-base text-muted-foreground">
                请检查姓名或身份证号是否输入正确。
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">姓名</TableHead>
                      <TableHead scope="col">身份证号</TableHead>
                      <TableHead scope="col">导入时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.fullName}</TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {maskNationalId(item.nationalId)}
                        </TableCell>
                        <TableCell>{formatImportedAt(item.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-base text-muted-foreground">
                  第 {page} / {totalPages} 页，共 {total} 人
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

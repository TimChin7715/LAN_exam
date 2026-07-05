import { useCallback, useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

import { adminEmptyTitle, adminMeta } from '@/components/admin/admin-typography';
import {
  AdminDataTable,
  AdminSectionCard,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/admin/AdminPagePrimitives';
import { QuestionDetailDialog } from '@/components/admin/qbank/QuestionDetailDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { getApiLoadErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  fetchQuestionDetail,
  fetchQuestions,
  questionTypeLabel,
  truncateStem,
  type QuestionDetail,
  type QuestionListItem,
  type QuestionType,
} from '@/lib/qbank';

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type QuestionListSectionProps = {
  batchId: string;
  title?: string;
};

export function QuestionListSection({
  batchId,
  title = '题目列表',
}: QuestionListSectionProps) {
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<QuestionType | 'ALL'>('ALL');
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(
    async (targetPage = page) => {
      setLoadingList(true);
      setListError(null);
      try {
        const data = await fetchQuestions({
          page: targetPage,
          pageSize,
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          batchId,
        });
        setItems(data.items);
        setTotal(data.total);
        setPage(data.page);
      } catch (err) {
        setListError(getApiLoadErrorMessage(err));
      } finally {
        setLoadingList(false);
      }
    },
    [page, pageSize, typeFilter, batchId],
  );

  useEffect(() => {
    setPage(1);
  }, [batchId, typeFilter]);

  useEffect(() => {
    void loadList(page);
  }, [loadList, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function openDetail(id: string) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const q = await fetchQuestionDetail(id);
      setDetail(q);
    } catch {
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <AdminSectionCard
        title={title}
        headerExtra={
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v as QuestionType | 'ALL');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="题型筛选">
              <SelectValue placeholder="题型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部题型</SelectItem>
              <SelectItem value="SINGLE">单选</SelectItem>
              <SelectItem value="MULTI">多选</SelectItem>
              <SelectItem value="JUDGE">判断</SelectItem>
            </SelectContent>
          </Select>
        }
        contentClassName="space-y-4"
      >
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
              <span>加载题目列表…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <BookOpen className="size-10 text-muted-foreground" aria-hidden />
              <h3 className={adminEmptyTitle}>暂无题目</h3>
              <p className={cn('max-w-2xl', adminMeta)}>
                该题库中还没有题目，或当前筛选条件下无匹配结果。
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <AdminDataTable>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">题型</TableHead>
                      <TableHead scope="col">题干</TableHead>
                      <TableHead scope="col">分值</TableHead>
                      <TableHead scope="col">导入时间</TableHead>
                      <TableHead scope="col" className="w-20">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => void openDetail(item.id)}
                      >
                        <TableCell>
                          <Badge variant="secondary">
                            {questionTypeLabel(item.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <span className="line-clamp-2">
                            {truncateStem(item.stem, 60)}
                          </span>
                        </TableCell>
                        <TableCell>{item.points}</TableCell>
                        <TableCell>{formatImportedAt(item.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="link"
                            className="min-h-11 px-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openDetail(item.id);
                            }}
                          >
                            查看
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </AdminDataTable>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={adminMeta}>
                  第 {page} / {totalPages} 页，共 {total} 题
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
      </AdminSectionCard>

      <QuestionDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        detail={detail}
        loading={detailLoading}
      />
    </>
  );
}

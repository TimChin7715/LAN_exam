import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { QuestionListSection } from '@/components/admin/qbank/QuestionListSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchQuestionBank, type QuestionBankDetail } from '@/lib/qbank';

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminQuestionBankDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [bank, setBank] = useState<QuestionBankDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBank = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuestionBank(batchId);
      setBank(data);
    } catch {
      setError('无法加载题库信息，请返回重试。');
      setBank(null);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void loadBank();
  }, [loadBank]);

  if (!batchId) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">无效的题库链接。</p>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/questions')}>
          返回题库管理
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/admin/questions"
          className="inline-block text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← 返回题库管理
        </Link>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Spinner className="size-5" />
            <span>加载题库信息…</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {error}
              <Button type="button" variant="outline" size="sm" onClick={() => void loadBank()}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : bank ? (
          <>
            <h1 className="text-xl font-semibold leading-tight text-foreground">
              {bank.fileName}
            </h1>
            <p className="text-base text-muted-foreground">
              共 {bank.itemCount} 题 · 上传于 {formatImportedAt(bank.createdAt)}
            </p>
          </>
        ) : null}
      </div>

      {!loading && !error && bank ? (
        <QuestionListSection batchId={batchId} />
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { RosterListSection } from '@/components/admin/roster/RosterListSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchRosterBatch, type RosterBatchDetail } from '@/lib/roster';

function formatImportedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminRosterBatchDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<RosterBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBatch = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRosterBatch(batchId);
      setBatch(data);
    } catch {
      setError('无法加载名单信息，请返回重试。');
      setBatch(null);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void loadBatch();
  }, [loadBatch]);

  if (!batchId) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">无效的名单链接。</p>
        <Button type="button" variant="outline" onClick={() => navigate('/admin/roster')}>
          返回名单管理
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/admin/roster"
          className="inline-block text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← 返回名单管理
        </Link>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Spinner className="size-5" />
            <span>加载名单信息…</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {error}
              <Button type="button" variant="outline" size="sm" onClick={() => void loadBatch()}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : batch ? (
          <>
            <h1 className="text-xl font-semibold leading-tight text-foreground">
              {batch.fileName}
            </h1>
            <p className="text-base text-muted-foreground">
              共 {batch.itemCount} 人 · 上传于 {formatImportedAt(batch.createdAt)}
              · 可在此增删改考生信息
            </p>
          </>
        ) : null}
      </div>

      {!loading && !error && batch ? (
        <RosterListSection
          batchId={batchId}
          onEntriesChanged={() => void loadBatch()}
        />
      ) : null}
    </div>
  );
}

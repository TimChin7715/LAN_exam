import { Button } from '@/components/ui/button';
import { AdminSectionCard } from '@/components/admin/AdminPagePrimitives';
import { adminMeta } from '@/components/admin/admin-typography';
import type { ImportSuccess } from '@/lib/roster';

type ImportResultSummaryProps = {
  result: ImportSuccess;
  onViewBatch?: (batchId: string) => void;
};

export function ImportResultSummary({
  result,
  onViewBatch,
}: ImportResultSummaryProps) {
  const fileName = result.fileName ?? 'import.xlsx';

  return (
    <AdminSectionCard
      title="导入成功"
      className="border-l-4 border-l-primary border-primary/30"
      contentClassName="space-y-2"
    >
      <p>成功导入 {result.importedCount} 人</p>
      {result.skippedCount > 0 ? (
        <p>跳过示例行 {result.skippedCount} 条</p>
      ) : null}
      <p className={adminMeta}>来源文件：{fileName}</p>
      {onViewBatch ? (
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={() => onViewBatch(result.batchId)}
        >
          查看本名单
        </Button>
      ) : null}
    </AdminSectionCard>
  );
}

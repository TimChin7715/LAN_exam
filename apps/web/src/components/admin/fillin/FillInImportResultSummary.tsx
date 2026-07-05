import { Button } from '@/components/ui/button';
import { AdminSectionCard } from '@/components/admin/AdminPagePrimitives';
import { adminMeta } from '@/components/admin/admin-typography';
import type { FillInImportSuccess } from '@/lib/fillin';

type FillInImportResultSummaryProps = {
  result: FillInImportSuccess;
  onDismiss?: () => void;
};

export function FillInImportResultSummary({
  result,
  onDismiss,
}: FillInImportResultSummaryProps) {
  return (
    <AdminSectionCard
      title="导入成功"
      className="border-l-4 border-l-primary border-primary/30"
      contentClassName="space-y-2"
    >
      <p>成功导入 {result.importedCount} 道操作题</p>
      <p className={adminMeta}>Word：{result.wordFileName}</p>
      {result.attachmentCount > 0 ? (
        <p className={adminMeta}>
          附件：{result.attachmentCount} 个（
          {result.attachmentFileNames.join('、')}）
        </p>
      ) : null}
      {onDismiss ? (
        <Button type="button" variant="outline" onClick={onDismiss}>
          知道了
        </Button>
      ) : null}
    </AdminSectionCard>
  );
}

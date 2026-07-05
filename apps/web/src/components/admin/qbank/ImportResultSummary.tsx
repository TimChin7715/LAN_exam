import { Button } from '@/components/ui/button';
import { AdminSectionCard } from '@/components/admin/AdminPagePrimitives';
import { adminMeta, adminSectionTitle } from '@/components/admin/admin-typography';
import type { ImportSuccess } from '@/lib/qbank';

import { QuestionPreviewCards } from './QuestionPreviewCards';

type ImportResultSummaryProps = {
  result: ImportSuccess;
  onViewBank?: (batchId: string) => void;
};

export function ImportResultSummary({
  result,
  onViewBank,
}: ImportResultSummaryProps) {
  const fileName = result.fileName ?? 'import.xlsx';

  return (
    <div className="space-y-4">
      <AdminSectionCard
        title="导入成功"
        className="border-l-4 border-l-primary border-primary/30"
        contentClassName="space-y-2"
      >
        <p>成功导入 {result.importedCount} 题</p>
        {result.skippedCount > 0 ? (
          <p>跳过示例行 {result.skippedCount} 条</p>
        ) : null}
        <p className={adminMeta}>来源文件：{fileName}</p>
        <p className={adminMeta}>多选题已按「全对满分，否则 0 分」规则入库。</p>
      </AdminSectionCard>

      {result.previewQuestions.length > 0 ? (
        <div className="space-y-3">
          <p className={adminSectionTitle}>本批预览（前 3 题）</p>
          <QuestionPreviewCards questions={result.previewQuestions} compact />
          {onViewBank ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onViewBank(result.batchId)}
            >
              查看本题库
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

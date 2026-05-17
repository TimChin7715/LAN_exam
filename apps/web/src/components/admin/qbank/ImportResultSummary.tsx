import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card className="border-l-4 border-l-primary border-primary/30">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">导入成功</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-base">
          <p>成功导入 {result.importedCount} 题</p>
          {result.skippedCount > 0 ? (
            <p>跳过示例行 {result.skippedCount} 条</p>
          ) : null}
          <p className="text-muted-foreground">来源文件：{fileName}</p>
          <p className="text-muted-foreground">
            多选题已按「全对满分，否则 0 分」规则入库。
          </p>
        </CardContent>
      </Card>

      {result.previewQuestions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">本批预览（前 3 题）</p>
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

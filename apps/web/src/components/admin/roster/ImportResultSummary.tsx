import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="border-l-4 border-l-primary border-primary/30">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">导入成功</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-base">
        <p>成功导入 {result.importedCount} 人</p>
        {result.skippedCount > 0 ? (
          <p>跳过示例行 {result.skippedCount} 条</p>
        ) : null}
        <p className="text-muted-foreground">来源文件：{fileName}</p>
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
      </CardContent>
    </Card>
  );
}

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="border-l-4 border-l-primary border-primary/30">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">导入成功</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-base">
        <p>成功导入 {result.importedCount} 道填空题</p>
        <p className="text-muted-foreground">Word：{result.wordFileName}</p>
        <p className="text-muted-foreground">Excel：{result.excelFileName}</p>
        {result.attachmentCount > 0 ? (
          <p className="text-muted-foreground">
            附件：{result.attachmentCount} 个（
            {result.attachmentFileNames.join('、')}）
          </p>
        ) : null}
        {onDismiss ? (
          <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
            知道了
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PracticalImportSuccess } from '@/lib/practical';

type PracticalImportResultSummaryProps = {
  result: PracticalImportSuccess;
  onDismiss?: () => void;
};

export function PracticalImportResultSummary({
  result,
  onDismiss,
}: PracticalImportResultSummaryProps) {
  return (
    <Card className="border-l-4 border-l-primary border-primary/30">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">导入成功</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-base">
        <p>操作题批次「{result.title}」已创建</p>
        <p className="text-muted-foreground">Word：{result.wordFileName}</p>
        <p className="text-muted-foreground">附件：{result.excelFileName}</p>
        <p className="text-sm text-muted-foreground">
          学员交卷后需考官人工评阅，系统不自动计分。
        </p>
        {onDismiss ? (
          <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
            知道了
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

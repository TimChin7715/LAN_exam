import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ImportRowError } from '@/lib/qbank';

type ImportErrorTableProps = {
  errors: ImportRowError[];
};

export function ImportErrorTable({ errors }: ImportErrorTableProps) {
  const sorted = [...errors].sort((a, b) => a.row - b.row);

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertDescription>
          导入未完成，题库中未新增任何题目。请根据下表修正 Excel 后重新导入。
        </AlertDescription>
      </Alert>

      <p className="text-base text-muted-foreground">
        共 {sorted.length} 处错误，请修正 Excel 后重新导入。
      </p>

      <div className="max-h-80 overflow-y-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">行号</TableHead>
              <TableHead scope="col">列名</TableHead>
              <TableHead scope="col">原因</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((err, index) => (
              <TableRow key={`${err.row}-${err.column ?? ''}-${index}`}>
                <TableCell>{err.row}</TableCell>
                <TableCell>{err.column ?? '—'}</TableCell>
                <TableCell>{err.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

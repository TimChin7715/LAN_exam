import type { LucideIcon } from 'lucide-react';
import { FileSpreadsheet, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';

export function formatImportFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isSpreadsheetFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.xls') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.csv')
  );
}

export function importFileIcon(name: string): LucideIcon {
  return isSpreadsheetFile(name) ? FileSpreadsheet : FileText;
}

type ImportSelectedFileDisplayProps = {
  file: File;
  className?: string;
  summary?: string;
};

export function ImportSelectedFileDisplay({
  file,
  className,
  summary,
}: ImportSelectedFileDisplayProps) {
  const Icon = importFileIcon(file.name);

  return (
    <div
      className={cn(
        'flex w-full max-w-full min-w-0 items-center gap-3 rounded-lg border-2 border-primary/40 bg-primary/10 px-4 py-3',
        className,
      )}
    >
      <Icon className="size-6 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-base font-semibold text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {summary ?? formatImportFileSize(file.size)}
        </p>
      </div>
    </div>
  );
}

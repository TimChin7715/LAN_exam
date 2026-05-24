import { useId, useRef } from 'react';
import { Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  MAX_FILLIN_BATCH_ATTACHMENTS,
  validateFillInAttachmentFile,
} from '@/lib/fillin';
import { SPREADSHEET_ACCEPT } from '@/lib/upload-formats';

export const MAX_FILLIN_ATTACHMENTS_TOTAL_MB = 50;

type FillInAttachmentsDropzoneProps = {
  files: File[];
  disabled?: boolean;
  dragOver: boolean;
  onChange: (files: File[]) => void;
  onValidationError: (message: string | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
};

function totalBytes(files: File[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

function mergeFiles(existing: File[], incoming: File[]): File[] {
  const next = [...existing];
  for (const file of incoming) {
    if (next.length >= MAX_FILLIN_BATCH_ATTACHMENTS) break;
    const duplicate = next.some(
      (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
    );
    if (!duplicate) next.push(file);
  }
  return next;
}

export function validateFillInAttachmentFiles(
  files: File[],
): string | null {
  if (files.length > MAX_FILLIN_BATCH_ATTACHMENTS) {
    return `最多选择 ${MAX_FILLIN_BATCH_ATTACHMENTS} 个附件`;
  }
  const total = totalBytes(files);
  if (total > MAX_FILLIN_ATTACHMENTS_TOTAL_MB * 1024 * 1024) {
    return `附件总大小不能超过 ${MAX_FILLIN_ATTACHMENTS_TOTAL_MB}MB`;
  }
  for (const file of files) {
    const msg = validateFillInAttachmentFile(file);
    if (msg) return `${file.name}：${msg}`;
  }
  return null;
}

export function FillInAttachmentsDropzone({
  files,
  disabled,
  dragOver,
  onChange,
  onValidationError,
  onDragOver,
  onDragLeave,
  onDrop,
}: FillInAttachmentsDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function applyFiles(next: File[]) {
    const msg = validateFillInAttachmentFiles(next);
    if (msg) {
      onValidationError(msg);
      return;
    }
    onValidationError(null);
    onChange(next);
  }

  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    applyFiles(mergeFiles(files, incoming));
  }

  function removeAt(index: number) {
    applyFiles(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Excel / CSV 附件</p>
      <div
        role="button"
        tabIndex={0}
        aria-label="Excel / CSV 附件"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
          files.length > 0
            ? 'border-primary/50 bg-muted/20'
            : dragOver
              ? 'border-primary bg-muted/30'
              : 'border-border'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <Upload
          className={`size-8 ${files.length > 0 ? 'text-primary' : 'text-muted-foreground'}`}
          aria-hidden
        />
        <p className="text-center text-base text-foreground">
          {files.length > 0 ? `已选择 ${files.length} 个文件` : '点击或拖拽上传'}
        </p>
        <p className="text-center text-sm text-muted-foreground">
          支持 .xls、.xlsx 或 .csv，选填；最多 {MAX_FILLIN_BATCH_ATTACHMENTS} 个，合计不超过{' '}
          {MAX_FILLIN_ATTACHMENTS_TOTAL_MB}MB；学员端打包为 ZIP 下载
        </p>
        {files.length > 0 && files.length < MAX_FILLIN_BATCH_ATTACHMENTS ? (
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-11 p-0"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            继续添加
          </Button>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={SPREADSHEET_ACCEPT}
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = '';
            addFiles(picked);
          }}
        />
      </div>
      {files.length > 0 ? (
        <ul className="space-y-1 rounded-md border bg-muted/20 p-2 text-sm">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate" title={file.name}>
                {file.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={`移除 ${file.name}`}
                disabled={disabled}
                onClick={() => removeAt(index)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

import { useId, useRef } from 'react';
import { CheckCircle2, Upload, X } from 'lucide-react';

import {
  formatImportFileSize,
  ImportSelectedFileDisplay,
  importFileIcon,
} from '@/components/admin/shared/ImportSelectedFileDisplay';
import { Button } from '@/components/ui/button';
import {
  MAX_FILLIN_BATCH_ATTACHMENTS,
  validateFillInAttachmentFile,
} from '@/lib/fillin';
import { FILLIN_ATTACHMENT_ACCEPT } from '@/lib/upload-formats';

export const MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES = 1024 * 1024 * 1024;
export const MAX_FILLIN_ATTACHMENTS_TOTAL_LABEL = '1GB';

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
  if (total > MAX_FILLIN_ATTACHMENTS_TOTAL_BYTES) {
    return `附件总大小不能超过 ${MAX_FILLIN_ATTACHMENTS_TOTAL_LABEL}`;
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
  const hasFiles = files.length > 0;
  const firstFile = files[0];

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
      <p className="text-base font-medium text-foreground">表格或压缩包附件</p>
      <div
        role="button"
        tabIndex={0}
        aria-label="表格或压缩包附件"
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
          hasFiles
            ? 'border-primary bg-primary/5'
            : dragOver
              ? 'border-primary bg-muted/30'
              : 'border-border'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        {hasFiles ? (
          <CheckCircle2 className="size-8 text-primary" aria-hidden />
        ) : (
          <Upload className="size-8 text-muted-foreground" aria-hidden />
        )}
        <p className="text-center text-base text-foreground">
          {hasFiles ? `文件已选择（${files.length} 个）` : '点击或拖拽上传'}
        </p>
        {firstFile ? (
          <ImportSelectedFileDisplay
            file={firstFile}
            summary={
              files.length > 1
                ? `等 ${files.length} 个文件，合计 ${formatImportFileSize(totalBytes(files))}`
                : formatImportFileSize(firstFile.size)
            }
          />
        ) : null}
        {!hasFiles ? (
          <p className="text-center text-base text-muted-foreground">
            支持 .xls / .xlsx / .csv 或 .zip / .rar / .7z / .tar.gz / .tgz / .gz，选填；最多{' '}
            {MAX_FILLIN_BATCH_ATTACHMENTS} 个，合计不超过 {MAX_FILLIN_ATTACHMENTS_TOTAL_LABEL}
            ；多个附件时学员端打包 ZIP 下载，仅一个压缩包时直接下载该文件
          </p>
        ) : null}
        {hasFiles && files.length < MAX_FILLIN_BATCH_ATTACHMENTS ? (
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
          accept={FILLIN_ATTACHMENT_ACCEPT}
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
      {hasFiles ? (
        <ul className="space-y-2">
          {files.map((file, index) => {
            const Icon = importFileIcon(file.name);
            return (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-2 rounded-lg border-2 border-primary/40 bg-primary/10 px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p
                      className="truncate text-base font-semibold text-foreground"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatImportFileSize(file.size)}
                    </p>
                  </div>
                </div>
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
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

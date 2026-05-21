import { useId, useRef } from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type ImportFileDropzoneProps = {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  disabled?: boolean;
  dragOver: boolean;
  onPick: (file: File | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
};

export function ImportFileDropzone({
  label,
  hint,
  accept,
  file,
  disabled,
  dragOver,
  onPick,
  onDragOver,
  onDragLeave,
  onDrop,
}: ImportFileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
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
          file
            ? 'border-primary/50 bg-muted/20'
            : dragOver
              ? 'border-primary bg-muted/30'
              : 'border-border'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <Upload
          className={`size-8 ${file ? 'text-primary' : 'text-muted-foreground'}`}
          aria-hidden
        />
        <p className="text-center text-base text-foreground">
          {file ? '已选择文件' : '点击或拖拽上传'}
        </p>
        {file ? (
          <p className="max-w-full truncate px-2 text-sm font-medium text-foreground">
            {file.name}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{hint}</p>
        {file ? (
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-11 p-0"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            更换文件
          </Button>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}

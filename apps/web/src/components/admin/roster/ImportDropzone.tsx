import { useCallback, useId, useRef, useState } from 'react';
import { CheckCircle2, Download, Upload } from 'lucide-react';

import { ImportSelectedFileDisplay } from '@/components/admin/shared/ImportSelectedFileDisplay';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  downloadRosterTemplate,
  importRosterFile,
  validateXlsxFile,
  type ImportFailure,
  type ImportSuccess,
} from '@/lib/roster';

type ImportDropzoneProps = {
  onSuccess: (result: ImportSuccess) => void;
  onFailure: (result: ImportFailure) => void;
  disabled?: boolean;
};

export function ImportDropzone({
  onSuccess,
  onFailure,
  disabled,
}: ImportDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const pickFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      setValidationError(null);
      return;
    }
    const error = validateXlsxFile(next);
    if (error) {
      setFile(null);
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setFile(next);
  }, []);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadRosterTemplate();
    } finally {
      setDownloading(false);
    }
  }

  async function handleImport() {
    if (!file || importing) return;
    const error = validateXlsxFile(file);
    if (error) {
      setValidationError(error);
      return;
    }

    setImporting(true);
    try {
      const result = await importRosterFile(file);
      if (result.ok) {
        onSuccess(result);
      } else {
        onFailure(result);
      }
    } catch {
      // toast handled in api layer
    } finally {
      setImporting(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="h-11 text-base"
        disabled={disabled || downloading}
        onClick={() => void handleDownload()}
      >
        <Download className="size-5" aria-hidden />
        {downloading ? '正在下载…' : '下载官方模板'}
      </Button>

      {validationError ? (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-label="选择 Excel 文件"
        aria-live="polite"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
          file
            ? 'border-primary bg-primary/5'
            : dragOver
              ? 'border-primary bg-muted/30'
              : 'border-border'
        } ${importing ? 'pointer-events-none opacity-60' : ''}`}
      >
        {file ? (
          <CheckCircle2 className="size-10 text-primary" aria-hidden />
        ) : (
          <Upload className="size-10 text-muted-foreground" aria-hidden />
        )}
        <p className="text-lg text-foreground">
          {file ? '文件已选择' : '点击或拖拽上传 Excel 文件'}
        </p>
        {file ? <ImportSelectedFileDisplay file={file} /> : null}
        {!file ? (
          <p className="text-base text-muted-foreground">支持 .xls、.xlsx 或 .csv</p>
        ) : null}
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
          accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="min-h-12 w-full text-base md:w-auto"
          disabled={!file || importing || disabled}
          onClick={() => void handleImport()}
        >
          {importing ? '正在导入…' : '开始导入'}
        </Button>
      </div>
    </div>
  );
}

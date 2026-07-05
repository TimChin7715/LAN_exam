import { useCallback, useState } from 'react';
import { Download } from 'lucide-react';

import {
  FillInAttachmentsDropzone,
  validateFillInAttachmentFiles,
} from '@/components/admin/fillin/FillInAttachmentsDropzone';
import { ImportFileDropzone } from '@/components/admin/shared/ImportFileDropzone';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  downloadFillInTemplate,
  importFillInBatch,
  validateDocxFile,
  type FillInImportFailure,
  type FillInImportSuccess,
} from '@/lib/fillin';
import { WORD_ACCEPT } from '@/lib/upload-formats';

type FillInImportFormProps = {
  onSuccess: (result: FillInImportSuccess) => void;
  onFailure: (failure: FillInImportFailure) => void;
  disabled?: boolean;
};

type FileSlot = 'word' | 'attachment';

export function FillInImportForm({
  onSuccess,
  onFailure,
  disabled,
}: FillInImportFormProps) {
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState<FileSlot | null>(null);

  const pickWord = useCallback((file: File | null) => {
    if (!file) {
      setWordFile(null);
      return;
    }
    const msg = validateDocxFile(file);
    if (msg) {
      setWordFile(null);
      setValidationError(msg);
      return;
    }
    setValidationError(null);
    setWordFile(file);
  }, []);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadFillInTemplate();
    } finally {
      setDownloading(false);
    }
  }

  async function handleImport() {
    if (!wordFile || importing) return;
    const attachmentMsg = validateFillInAttachmentFiles(attachmentFiles);
    if (attachmentMsg) {
      setValidationError(attachmentMsg);
      return;
    }
    setImporting(true);
    try {
      const result = await importFillInBatch(wordFile, attachmentFiles);
      if (!result.ok) {
        onFailure(result);
        return;
      }
      onSuccess(result);
      setWordFile(null);
      setAttachmentFiles([]);
      setValidationError(null);
    } catch {
      /* toast in importFillInBatch */
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(slot: FileSlot, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    if (slot === 'attachment') {
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length === 0) return;
      const msg = validateFillInAttachmentFiles(
        [...attachmentFiles, ...dropped].slice(0, 10),
      );
      if (msg) {
        setValidationError(msg);
        return;
      }
      setValidationError(null);
      const merged = [...attachmentFiles];
      for (const file of dropped) {
        if (merged.length >= 10) break;
        if (
          !merged.some(
            (f) =>
              f.name === file.name &&
              f.size === file.size &&
              f.lastModified === file.lastModified,
          )
        ) {
          merged.push(file);
        }
      }
      setAttachmentFiles(merged);
      return;
    }
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    pickWord(dropped);
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || downloading}
        onClick={() => void handleDownload()}
      >
        <Download className="size-4" aria-hidden />
        {downloading ? '正在下载…' : '下载官方模板'}
      </Button>

      {validationError ? (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ImportFileDropzone
          label="Word 试卷"
          hint="支持 .doc 或 .docx；推荐使用 .docx 以保留图片"
          note="每空使用【标准答案】（分值）格式，例如【北京|北平】（2分）。多个可接受答案用 | 分隔。"
          accept={WORD_ACCEPT}
          file={wordFile}
          disabled={disabled || importing}
          dragOver={dragOver === 'word'}
          onPick={pickWord}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver('word');
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop('word', e)}
        />
        <FillInAttachmentsDropzone
          files={attachmentFiles}
          disabled={disabled || importing}
          dragOver={dragOver === 'attachment'}
          onChange={setAttachmentFiles}
          onValidationError={setValidationError}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver('attachment');
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop('attachment', e)}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="min-h-11 w-full md:w-auto"
          disabled={!wordFile || importing || disabled}
          onClick={() => void handleImport()}
        >
          {importing ? '正在导入…' : '开始导入'}
        </Button>
      </div>
    </div>
  );
}

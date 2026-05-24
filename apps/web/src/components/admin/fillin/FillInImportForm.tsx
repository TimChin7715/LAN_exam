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
  validateFillInExcelFile,
  type FillInImportFailure,
  type FillInImportSuccess,
} from '@/lib/fillin';
import {
  ANSWER_SHEET_ACCEPT,
  WORD_ACCEPT,
} from '@/lib/upload-formats';

type FillInImportFormProps = {
  onSuccess: (result: FillInImportSuccess) => void;
  onFailure: (failure: FillInImportFailure) => void;
  disabled?: boolean;
};

type FileSlot = 'word' | 'attachment' | 'excel';

export function FillInImportForm({
  onSuccess,
  onFailure,
  disabled,
}: FillInImportFormProps) {
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
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

  const pickExcel = useCallback((file: File | null) => {
    if (!file) {
      setExcelFile(null);
      return;
    }
    const msg = validateFillInExcelFile(file);
    if (msg) {
      setExcelFile(null);
      setValidationError(msg);
      return;
    }
    setValidationError(null);
    setExcelFile(file);
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
    if (!wordFile || !excelFile || importing) return;
    const attachmentMsg = validateFillInAttachmentFiles(attachmentFiles);
    if (attachmentMsg) {
      setValidationError(attachmentMsg);
      return;
    }
    setImporting(true);
    try {
      const result = await importFillInBatch(
        wordFile,
        excelFile,
        attachmentFiles,
      );
      if (!result.ok) {
        onFailure(result);
        return;
      }
      onSuccess(result);
      setWordFile(null);
      setAttachmentFiles([]);
      setExcelFile(null);
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
    if (slot === 'word') pickWord(dropped);
    else pickExcel(dropped);
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

      <div className="grid gap-4 md:grid-cols-3">
        <ImportFileDropzone
          label="Word 题目"
          hint="完整试卷 .doc/.docx，无需与 Excel 题号对应"
          note="为考试机能显示图片请上传.docx格式文档"
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
        <ImportFileDropzone
          label="Excel 答题卡"
          hint="支持 .xls 或 .xlsx，须含工作表「答题卡」（列：题号、答案、分值）"
          accept={ANSWER_SHEET_ACCEPT}
          file={excelFile}
          disabled={disabled || importing}
          dragOver={dragOver === 'excel'}
          onPick={pickExcel}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver('excel');
          }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => handleDrop('excel', e)}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="min-h-11 w-full md:w-auto"
          disabled={!wordFile || !excelFile || importing || disabled}
          onClick={() => void handleImport()}
        >
          {importing ? '正在导入…' : '开始导入'}
        </Button>
      </div>
    </div>
  );
}

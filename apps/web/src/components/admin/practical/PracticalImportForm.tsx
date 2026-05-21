import { useCallback, useState } from 'react';

import { ImportFileDropzone } from '@/components/admin/shared/ImportFileDropzone';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  importPracticalBatch,
  validateDocxFile,
  validatePracticalSpreadsheetFile,
  type PracticalImportSuccess,
} from '@/lib/practical';
import { SPREADSHEET_ACCEPT, WORD_ACCEPT } from '@/lib/upload-formats';

type PracticalImportFormProps = {
  onSuccess: (result: PracticalImportSuccess) => void;
  disabled?: boolean;
};

type FileSlot = 'word' | 'excel';

export function PracticalImportForm({
  onSuccess,
  disabled,
}: PracticalImportFormProps) {
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
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
    const msg = validatePracticalSpreadsheetFile(file);
    if (msg) {
      setExcelFile(null);
      setValidationError(msg);
      return;
    }
    setValidationError(null);
    setExcelFile(file);
  }, []);

  async function handleImport() {
    if (!wordFile || !excelFile || importing) return;
    setImporting(true);
    try {
      const result = await importPracticalBatch(wordFile, excelFile);
      onSuccess(result);
      setWordFile(null);
      setExcelFile(null);
      setValidationError(null);
    } catch {
      /* toast in importPracticalBatch */
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(slot: FileSlot, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    if (slot === 'word') pickWord(dropped);
    else pickExcel(dropped);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        上传 Word 试卷与 Excel/CSV 附件，供学员下载作答；操作题不入库解析，由考官人工评阅。
      </p>

      {validationError ? (
        <Alert variant="destructive">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ImportFileDropzone
          label="Word 试卷"
          hint="支持 .doc 或 .docx"
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
        <ImportFileDropzone
          label="Excel / CSV 附件"
          hint="支持 .xls、.xlsx 或 .csv"
          accept={SPREADSHEET_ACCEPT}
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

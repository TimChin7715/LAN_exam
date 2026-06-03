import { useId, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, studentApi, type PracticalPaperMeta } from '@/lib/student';
import { validateDocxFile } from '@/lib/practical';
import { WORD_ACCEPT } from '@/lib/upload-formats';

type StudentPracticalSectionProps = {
  examId: string;
  meta: PracticalPaperMeta;
  readOnly: boolean;
  submittedFileName?: string | null;
  onUploadSuccess: (meta: PracticalPaperMeta) => void;
};

export function StudentPracticalSection({
  examId,
  meta,
  readOnly,
  submittedFileName,
  onUploadSuccess,
}: StudentPracticalSectionProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<
    'paper' | 'excel' | 'answer' | null
  >(null);

  async function handleDownloadPaper() {
    setDownloading('paper');
    try {
      await studentApi.downloadPracticalPaper(examId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下载试卷失败');
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadExcel() {
    setDownloading('excel');
    try {
      await studentApi.downloadPracticalExcel(examId, meta.excelFileName);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下载 Excel 失败');
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadAnswer(fileName: string) {
    setDownloading('answer');
    try {
      await studentApi.downloadPracticalAnswer(examId, fileName);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下载答卷失败');
    } finally {
      setDownloading(null);
    }
  }

  async function handleUpload(file: File) {
    const err = validateDocxFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setUploading(true);
    try {
      const result = await studentApi.uploadPracticalAnswer(examId, file);
      onUploadSuccess({
        ...meta,
        hasAnswerDraft: true,
        answerFileName: result.docxFileName,
        answerUpdatedAt: result.updatedAt,
      });
      toast.success('操作题作答已上传');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : '上传失败');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const displayFile =
    submittedFileName ?? meta.answerFileName ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">操作题</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          批次：{meta.batchTitle}。请下载 Word 试卷，在本机 Word/WPS 中作答后上传
          .doc 或 .docx；Excel 附件可在考试期间随时下载参考。
        </p>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
          <li>下载 Word 试卷并在本机编辑</li>
          <li>下载 Excel 附件（如需）</li>
          <li>上传已作答的 Word 文档</li>
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={readOnly || downloading === 'paper'}
            onClick={() => void handleDownloadPaper()}
          >
            <Download className="size-4" aria-hidden />
            {downloading === 'paper' ? '下载中…' : '下载 Word 试卷'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={downloading === 'excel'}
            onClick={() => void handleDownloadExcel()}
          >
            <Download className="size-4" aria-hidden />
            {downloading === 'excel' ? '下载中…' : `下载 ${meta.excelFileName}`}
          </Button>
          {readOnly && displayFile ? (
            <Button
              type="button"
              variant="outline"
              disabled={downloading === 'answer'}
              onClick={() => void handleDownloadAnswer(displayFile)}
            >
              {downloading === 'answer' ? '下载中…' : '下载已提交作答'}
            </Button>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="space-y-2">
            <label
              htmlFor={inputId}
              className="flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground hover:bg-muted/50"
            >
              <Upload className="size-8 opacity-60" aria-hidden />
              {uploading
                ? '上传中…'
                : meta.hasAnswerDraft && meta.answerFileName
                  ? `已上传：${meta.answerFileName}（点击更换）`
                  : '点击选择作答 Word（.doc/.docx）并上传'}
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept={WORD_ACCEPT}
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
            </label>
            {meta.answerUpdatedAt ? (
              <p className="text-xs text-muted-foreground">
                上次上传：{new Date(meta.answerUpdatedAt).toLocaleString()}
              </p>
            ) : null}
            {!meta.hasAnswerDraft ? (
              <Alert>
                <AlertDescription>
                  交卷前须上传操作题作答 Word 文档。
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : displayFile ? (
          <p className="text-sm text-muted-foreground">
            已提交文件：{displayFile}
          </p>
        ) : null}

        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            正在上传…
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

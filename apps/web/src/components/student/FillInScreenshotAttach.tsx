import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, studentApi, type FillInScreenshotInfo } from '@/lib/student';

export const MAX_FILLIN_SCREENSHOTS_PER_BLANK = 5;

type FillInScreenshotAttachProps = {
  examId: string;
  examQuestionId: string;
  screenshots: FillInScreenshotInfo[];
  readOnly: boolean;
  onScreenshotsChange: (
    examQuestionId: string,
    screenshots: FillInScreenshotInfo[],
  ) => void;
};

export function FillInScreenshotAttach({
  examId,
  examQuestionId,
  screenshots,
  readOnly,
  onScreenshotsChange,
}: FillInScreenshotAttachProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const atLimit = screenshots.length >= MAX_FILLIN_SCREENSHOTS_PER_BLANK;

  async function uploadFile(file: File) {
    if (readOnly || atLimit) return;
    setUploading(true);
    try {
      const res = await studentApi.uploadFillInScreenshot(
        examId,
        examQuestionId,
        file,
      );
      onScreenshotsChange(examQuestionId, [
        ...screenshots,
        res.screenshot,
      ]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '上传截图失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (readOnly) return;
    setDeletingId(id);
    try {
      await studentApi.deleteFillInScreenshot(examId, id);
      onScreenshotsChange(
        examQuestionId,
        screenshots.filter((s) => s.id !== id),
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '删除截图失败');
    } finally {
      setDeletingId(null);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (readOnly || atLimit) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        void uploadFile(file);
        return;
      }
    }
  }

  return (
    <div
      className="mt-2 space-y-2"
      onPaste={handlePaste}
    >
      {screenshots.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {screenshots.map((shot) => (
            <li
              key={shot.id}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-muted/30"
            >
              <img
                src={shot.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              {!readOnly ? (
                <button
                  type="button"
                  className="absolute right-0 top-0 flex size-5 items-center justify-center rounded-bl bg-destructive text-destructive-foreground"
                  disabled={deletingId === shot.id}
                  aria-label="删除截图"
                  onClick={() => void handleDelete(shot.id)}
                >
                  {deletingId === shot.id ? (
                    <Spinner className="size-3" />
                  ) : (
                    <Trash2 className="size-3" aria-hidden />
                  )}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void uploadFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={uploading || atLimit}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Spinner className="size-3.5" />
            ) : (
              <Upload className="size-3.5" aria-hidden />
            )}
            上传截图
          </Button>
          <span className="text-xs text-muted-foreground">
            <ImagePlus className="mr-0.5 inline size-3.5" aria-hidden />
            可粘贴截图
            {atLimit ? `（已满 ${MAX_FILLIN_SCREENSHOTS_PER_BLANK} 张）` : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

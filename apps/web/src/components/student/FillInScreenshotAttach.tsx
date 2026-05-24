import { useRef, useState } from 'react';
import { Lightbulb, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, studentApi, type FillInScreenshotInfo } from '@/lib/student';
import { cn } from '@/lib/utils';

export const MAX_FILLIN_SCREENSHOTS_PER_BLANK = 5;

/** 底部截图区常态高度（与单张缩略图 h-16 一致） */
const SCREENSHOT_ZONE_MIN_H = 'min-h-16';

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
    <div className="flex flex-col gap-2" onPaste={handlePaste}>
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
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
            <Lightbulb className="size-4 shrink-0" aria-hidden />
            可直接粘贴截图
            {atLimit ? (
              <span className="text-amber-600/80 dark:text-amber-400/80">
                {`（已满 ${MAX_FILLIN_SCREENSHOTS_PER_BLANK} 张）`}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'border-t border-border/60 pt-2',
          SCREENSHOT_ZONE_MIN_H,
          screenshots.length === 0 && 'flex items-stretch',
        )}
      >
        {screenshots.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {screenshots.map((shot) => (
              <li
                key={shot.id}
                className="relative h-16 w-16 shrink-0 overflow-hidden rounded border bg-muted/30"
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
        ) : (
          <div
            className={cn(
              'flex w-full flex-1 items-center justify-center rounded-md border border-dashed border-border/80 bg-muted/25 px-2 text-xs text-muted-foreground',
              SCREENSHOT_ZONE_MIN_H,
            )}
          >
            {readOnly ? '暂无截图' : '截图将显示在此处'}
          </div>
        )}
      </div>
    </div>
  );
}

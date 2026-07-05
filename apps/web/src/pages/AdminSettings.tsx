import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import {
  AdminPageHeader,
  AdminSectionCard,
} from '@/components/admin/AdminPagePrimitives';
import { adminMeta } from '@/components/admin/admin-typography';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  CLEAR_ALL_DATA_CONFIRM_PHRASE,
  clearAllAdminData,
  fetchAdminSettings,
  updateAdminSettings,
} from '@/lib/admin-settings';
import { getApiLoadErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

function formatClearSummary(deleted: {
  exams: number;
  questionBatches: number;
  rosterBatches: number;
  fillInBatches: number;
}): string {
  const parts: string[] = [];
  if (deleted.exams > 0) parts.push(`${deleted.exams} 场考试`);
  if (deleted.questionBatches > 0) parts.push(`${deleted.questionBatches} 个客观题库`);
  if (deleted.fillInBatches > 0) parts.push(`${deleted.fillInBatches} 个操作题批次`);
  if (deleted.rosterBatches > 0) parts.push(`${deleted.rosterBatches} 份名单`);
  return parts.length > 0 ? parts.join('、') : '无业务数据';
}

export default function AdminSettings() {
  const [showSeatBoard, setShowSeatBoard] = useState(true);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState('');
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await fetchAdminSettings();
      setShowSeatBoard(settings.showSeatBoard);
      setAppVersion(settings.appVersion ?? null);
    } catch (err) {
      toast.error(getApiLoadErrorMessage(err) || '无法加载设置。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleShowSeatBoardChange(checked: boolean) {
    const previous = showSeatBoard;
    setShowSeatBoard(checked);
    setSaving(true);
    try {
      await updateAdminSettings({ showSeatBoard: checked });
      toast.success(checked ? '已开启座位表展示。' : '已关闭座位表展示。');
    } catch (err) {
      setShowSeatBoard(previous);
      toast.error(getApiLoadErrorMessage(err) || '保存设置失败。');
    } finally {
      setSaving(false);
    }
  }

  const clearConfirmReady =
    clearConfirmInput.trim() === CLEAR_ALL_DATA_CONFIRM_PHRASE;

  async function handleClearAllData() {
    if (!clearConfirmReady) return;
    setClearing(true);
    try {
      const deleted = await clearAllAdminData();
      setClearDialogOpen(false);
      setClearConfirmInput('');
      toast.success(`已清除全部数据（${formatClearSummary(deleted)}）。`);
    } catch (err) {
      toast.error(getApiLoadErrorMessage(err) || '清除数据失败，请稍后重试。');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="设置"
        showBack={false}
        description={
          <>
            考场相关配置将在此维护。
            {appVersion ? (
              <span className="mt-1 block text-sm">当前版本 {appVersion}</span>
            ) : null}
          </>
        }
      />

      <AdminSectionCard title="考试座位表">
        <p className={cn('mb-4', adminMeta)}>
          关闭后，学员登录页与管理端考试详情均不显示座位表。
        </p>
        {loading ? (
          <div className="flex min-h-[3rem] items-center">
            <Spinner />
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Checkbox
              id="show-seat-board"
              checked={showSeatBoard}
              disabled={saving}
              onCheckedChange={(value) => {
                void handleShowSeatBoardChange(value === true);
              }}
            />
            <div className="space-y-1">
              <Label htmlFor="show-seat-board" className="cursor-pointer font-semibold">
                展示考试座位表
              </Label>
              <p className={adminMeta}>
                开启后，学员可在登录页查看当前考试的座位安排；考官可在考试详情中查看。
              </p>
            </div>
          </div>
        )}
      </AdminSectionCard>

      <AdminSectionCard
        title="清除全部数据"
        titleClassName="text-xl font-semibold text-destructive"
        className="border-destructive/40"
      >
        <p className={cn('mb-4', adminMeta)}>
          删除当前管理账号下的全部考试、题库、名单、操作题批次及学员答卷文件。
          座位表等本页设置会保留。此操作不可恢复，请在每场考试结束后、下一场开考前使用。
        </p>
        <AlertDialog
          open={clearDialogOpen}
          onOpenChange={(open) => {
            setClearDialogOpen(open);
            if (!open) setClearConfirmInput('');
          }}
        >
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={loading}>
              清除全部数据…
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认清除全部数据？</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className={cn('space-y-3', adminMeta)}>
                  <p>
                    将永久删除所有考试记录、成绩与答卷、客观题/操作题批次、名单及关联上传文件。
                    进行中的考试也会被清除，学员端将无法继续作答。
                  </p>
                  <p>
                    请在下方输入{' '}
                    <span className="font-semibold text-foreground">
                      {CLEAR_ALL_DATA_CONFIRM_PHRASE}
                    </span>{' '}
                    以确认。
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label htmlFor="clear-confirm" className="sr-only">
                确认短语
              </Label>
              <Input
                id="clear-confirm"
                value={clearConfirmInput}
                onChange={(e) => setClearConfirmInput(e.target.value)}
                placeholder={CLEAR_ALL_DATA_CONFIRM_PHRASE}
                autoComplete="off"
                disabled={clearing}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearing}>取消</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!clearConfirmReady || clearing}
                onClick={(e) => {
                  e.preventDefault();
                  void handleClearAllData();
                }}
              >
                {clearing ? '正在清除…' : '确认清除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminSectionCard>

      <Link
        to="/admin"
        className="text-base font-semibold text-primary hover:underline"
      >
        返回首页
      </Link>
    </div>
  );
}

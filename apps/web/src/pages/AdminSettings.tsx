import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

function formatClearSummary(deleted: {
  exams: number;
  questionBatches: number;
  rosterBatches: number;
  fillInBatches: number;
  practicalBatches: number;
}): string {
  const parts: string[] = [];
  if (deleted.exams > 0) parts.push(`${deleted.exams} 场考试`);
  if (deleted.questionBatches > 0) parts.push(`${deleted.questionBatches} 个客观题库`);
  if (deleted.fillInBatches > 0) parts.push(`${deleted.fillInBatches} 个填空题批次`);
  if (deleted.practicalBatches > 0) parts.push(`${deleted.practicalBatches} 个操作题批次`);
  if (deleted.rosterBatches > 0) parts.push(`${deleted.rosterBatches} 份名单`);
  return parts.length > 0 ? parts.join('、') : '无业务数据';
}

export default function AdminSettings() {
  const [showSeatBoard, setShowSeatBoard] = useState(true);
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
      <div>
        <h1 className="text-xl font-semibold leading-tight text-foreground">设置</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          考场相关配置将在此维护。
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="text-base font-semibold sm:text-lg">
            考试座位表
          </CardTitle>
          <CardDescription className="text-sm">
            关闭后，学员登录页与管理端考试详情均不显示座位表。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
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
                <Label
                  htmlFor="show-seat-board"
                  className="cursor-pointer text-sm font-semibold leading-none"
                >
                  展示考试座位表
                </Label>
                <p className="text-sm text-muted-foreground">
                  开启后，学员可在登录页查看当前考试的座位安排；考官可在考试详情中查看。
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="text-base font-semibold text-destructive sm:text-lg">
            清除全部数据
          </CardTitle>
          <CardDescription className="text-sm">
            删除当前管理账号下的全部考试、题库、名单、填空题与操作题批次及学员答卷文件。
            座位表等本页设置会保留。此操作不可恢复，请在每场考试结束后、下一场开考前使用。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
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
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      将永久删除所有考试记录、成绩与答卷、客观题/填空题/操作题批次、名单及关联上传文件。
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
        </CardContent>
      </Card>

      <Link
        to="/admin/dashboard"
        className="text-sm font-semibold text-primary hover:underline"
      >
        返回首页
      </Link>
    </div>
  );
}

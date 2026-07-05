import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';

import { toast } from 'sonner';

import { AdminPageHeader, AdminSectionCard, AdminDataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/AdminPagePrimitives';
import { adminMeta } from '@/components/admin/admin-typography';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  createExam,
  defaultExamSchedule,
  examContentModulesLabel,
  examStatusLabel,
  fetchFillInBatches,
  fetchQuestionBatches,
  fetchRosterBatches,
  formatExamScheduleRange,
  handleExamApiError,
  listExams,
  type BatchPickerItem,
  type ExamContentModule,
  type ExamListItem,
  type FillInBatchListItem,
} from '@/lib/exam';

export default function AdminExams() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [moduleObjective, setModuleObjective] = useState(true);
  const [moduleFillIn, setModuleFillIn] = useState(false);
  const [questionBatchId, setQuestionBatchId] = useState('');
  const [fillInBatchId, setFillInBatchId] = useState('');
  const [rosterBatchId, setRosterBatchId] = useState('');
  const [questionBatches, setQuestionBatches] = useState<BatchPickerItem[]>([]);
  const [fillInBatches, setFillInBatches] = useState<FillInBatchListItem[]>([]);
  const [rosterBatches, setRosterBatches] = useState<BatchPickerItem[]>([]);
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listExams());
    } catch (err) {
      handleExamApiError(err, '无法加载考试列表。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dialogOpen) return;
    const defaults = defaultExamSchedule();
    setScheduledStart(defaults.start);
    setScheduledEnd(defaults.end);
    void (async () => {
      try {
        const [qb, fb, rb] = await Promise.all([
          fetchQuestionBatches(),
          fetchFillInBatches(),
          fetchRosterBatches(),
        ]);
        setQuestionBatches(qb);
        setFillInBatches(fb);
        setRosterBatches(rb);
      } catch (err) {
        handleExamApiError(err, '无法加载批次列表。');
      }
    })();
  }, [dialogOpen]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !rosterBatchId) {
      toast.error('请填写考试名称并选择名单批次。');
      return;
    }
    const contentModules: ExamContentModule[] = [];
    if (moduleObjective) contentModules.push('OBJECTIVE');
    if (moduleFillIn) contentModules.push('FILL');
    if (contentModules.length === 0) {
      toast.error('请至少选择一种考试内容。');
      return;
    }
    if (moduleObjective && !questionBatchId) {
      toast.error('请选择客观题题库批次。');
      return;
    }
    if (moduleFillIn && !fillInBatchId) {
      toast.error('请选择操作题批次。');
      return;
    }
    if (!scheduledStart || !scheduledEnd) {
      toast.error('请设定考试开始与结束时间。');
      return;
    }
    const startDate = new Date(scheduledStart);
    const endDate = new Date(scheduledEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      toast.error('考试时间格式无效。');
      return;
    }
    if (endDate <= startDate) {
      toast.error('结束时间必须晚于开始时间。');
      return;
    }
    setCreating(true);
    try {
      const examId = await createExam({
        title: title.trim(),
        contentModules,
        questionBatchId: moduleObjective ? questionBatchId : undefined,
        fillInBatchId: moduleFillIn ? fillInBatchId : undefined,
        rosterBatchId,
        scheduledStartAt: startDate.toISOString(),
        scheduledEndAt: endDate.toISOString(),
      });
      toast.success('考试已创建。');
      setDialogOpen(false);
      setTitle('');
      setModuleObjective(true);
      setModuleFillIn(false);
      setQuestionBatchId('');
      setFillInBatchId('');
      setRosterBatchId('');
      setScheduledStart('');
      setScheduledEnd('');
      void navigate(`/admin/exams/${examId}`);
    } catch (err) {
      handleExamApiError(err, '创建考试失败。');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="考试管理"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-5" aria-hidden />
                新建考试
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={(e) => void handleCreate(e)}>
                <DialogHeader>
                  <DialogTitle>新建考试</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="exam-title">考试名称</Label>
                    <Input
                      id="exam-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>考试内容（可多选）</Label>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="mod-objective"
                          checked={moduleObjective}
                          onCheckedChange={(v) => setModuleObjective(v === true)}
                        />
                        <Label htmlFor="mod-objective" className="font-normal">
                          客观题
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="mod-fillin"
                          checked={moduleFillIn}
                          onCheckedChange={(v) => setModuleFillIn(v === true)}
                        />
                        <Label htmlFor="mod-fillin" className="font-normal">
                          操作题
                        </Label>
                      </div>
                    </div>
                  </div>
                  {moduleObjective ? (
                    <div className="grid gap-2">
                      <Label>客观题批次</Label>
                      <Select
                        value={questionBatchId}
                        onValueChange={setQuestionBatchId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择客观题导入批次" />
                        </SelectTrigger>
                        <SelectContent>
                          {questionBatches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.fileName}（{b.itemCount} 题）
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {moduleFillIn ? (
                    <div className="grid gap-2">
                      <Label>操作题批次</Label>
                      <Select
                        value={fillInBatchId}
                        onValueChange={setFillInBatchId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择操作题批次" />
                        </SelectTrigger>
                        <SelectContent>
                          {fillInBatches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.title}（{b.itemCount} 题）
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div className="grid gap-2">
                    <Label htmlFor="exam-start">开始时间</Label>
                    <Input
                      id="exam-start"
                      type="datetime-local"
                      value={scheduledStart}
                      onChange={(e) => setScheduledStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="exam-end">结束时间</Label>
                    <Input
                      id="exam-end"
                      type="datetime-local"
                      value={scheduledEnd}
                      onChange={(e) => setScheduledEnd(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>名单批次</Label>
                    <Select
                      value={rosterBatchId}
                      onValueChange={setRosterBatchId}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择名单导入批次" />
                      </SelectTrigger>
                      <SelectContent>
                        {rosterBatches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.fileName}（{b.itemCount} 人）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? <Spinner className="size-4" /> : '创建'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <AdminSectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="size-5" aria-hidden />
            考试列表
          </span>
        }
      >
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <p className={adminMeta}>暂无考试，请点击「新建考试」。</p>
          ) : (
            <AdminDataTable>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>考试时间</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>题目</TableHead>
                  <TableHead>提交</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatExamScheduleRange(
                        exam.scheduledStartAt,
                        exam.scheduledEndAt,
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {examContentModulesLabel(exam.contentModules)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{examStatusLabel(exam.status)}</Badge>
                    </TableCell>
                    <TableCell>{exam.questionCount}</TableCell>
                    <TableCell>{exam.submissionCount}</TableCell>
                    <TableCell>
                      <Button variant="outline" asChild>
                        <Link to={`/admin/exams/${exam.id}`}>详情</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </AdminDataTable>
          )}
      </AdminSectionCard>
    </div>
  );
}

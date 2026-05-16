import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { questionTypeLabel } from '@/lib/qbank';
import {
  ApiError,
  STUDENT_ALREADY_SUBMITTED_MESSAGE,
  studentApi,
  type ExamPaperItem,
  type ExamSubmissionItem,
} from '@/lib/student';

type AnswerState = Record<string, string>;

function parseMultiKeys(raw: string): string[] {
  return raw
    .split(/[,，、\s]+/)
    .map((k) => k.trim().toUpperCase())
    .filter((k) => /^[A-Z]$/.test(k));
}

function joinMultiKeys(keys: string[]): string {
  return [...new Set(keys)].sort().join(',');
}

export default function StudentExamTake() {
  const [searchParams] = useSearchParams();
  const examId = searchParams.get('examId') ?? '';

  const [items, setItems] = useState<(ExamPaperItem | ExamSubmissionItem)[]>([]);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadExam = useCallback(async () => {
    if (!examId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      try {
        const submission = await studentApi.examSubmission(examId);
        setItems(submission.items);
        setAnswers(
          Object.fromEntries(
            submission.items.map((i) => [i.examQuestionId, i.selectedKeys]),
          ),
        );
        setTotalScore(submission.totalScore);
        setReadOnly(true);
        return;
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err;
        }
      }

      const paper = await studentApi.examPaper(examId);
      setItems(paper.items);
      setAnswers(
        Object.fromEntries(
          paper.items.map((i) => [i.examQuestionId, i.selectedKeys ?? '']),
        ),
      );
      setReadOnly(false);
      setTotalScore(null);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || '无法加载试卷。');
      } else {
        toast.error('无法加载试卷。');
      }
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void loadExam();
  }, [loadExam]);

  const scheduleSave = useCallback(
    (nextAnswers: AnswerState, questionItems: ExamPaperItem[]) => {
      if (readOnly || !examId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void (async () => {
          setSaveStatus('saving');
          try {
            const payload = questionItems.map((q) => ({
              examQuestionId: q.examQuestionId,
              selectedKeys: nextAnswers[q.examQuestionId] ?? '',
            }));
            if (payload.length === 0) return;
            await studentApi.saveAnswers(examId, payload);
            setSaveStatus('saved');
          } catch (err) {
            setSaveStatus('idle');
            if (err instanceof ApiError) {
              toast.error(err.message || '保存失败。');
            }
          }
        })();
      }, 2000);
    },
    [examId, readOnly],
  );

  function updateAnswer(examQuestionId: string, value: string) {
    if (readOnly) return;
    setAnswers((prev) => {
      const next = { ...prev, [examQuestionId]: value };
      scheduleSave(next, items as ExamPaperItem[]);
      return next;
    });
    setSaveStatus('idle');
  }

  function toggleMulti(examQuestionId: string, key: string, checked: boolean) {
    const current = parseMultiKeys(answers[examQuestionId] ?? '');
    const next = checked
      ? [...current, key]
      : current.filter((k) => k !== key);
    updateAnswer(examQuestionId, joinMultiKeys(next));
  }

  async function handleSubmit() {
    if (!examId || readOnly) return;
    setSubmitting(true);
    try {
      const result = await studentApi.submitExam(examId);
      toast.success(`提交成功，得分：${result.totalScore}`);
      setSubmitOpen(false);
      await loadExam();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error(STUDENT_ALREADY_SUBMITTED_MESSAGE);
          await loadExam();
        } else {
          toast.error(err.message || '提交失败。');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const saveLabel = useMemo(() => {
    if (readOnly) return null;
    if (saveStatus === 'saving') return '正在保存…';
    if (saveStatus === 'saved') return '已保存';
    return null;
  }, [readOnly, saveStatus]);

  if (!examId) {
    return (
      <Alert variant="destructive">
        <AlertDescription>缺少考试参数，请从准备页重新进入。</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      {readOnly ? (
        <Alert>
          <AlertDescription>
            {totalScore !== null
              ? `您已提交本场考试，总分 ${totalScore} 分。答卷为只读。`
              : '您已提交本场考试，答卷为只读。'}
          </AlertDescription>
        </Alert>
      ) : null}

      {saveLabel ? (
        <p className="text-sm text-muted-foreground">{saveLabel}</p>
      ) : null}

      {items.map((item, index) => {
        const submissionItem = item as ExamSubmissionItem;
        const showResult = readOnly && 'isCorrect' in submissionItem;

        return (
          <Card key={item.examQuestionId}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span>第 {index + 1} 题</span>
                <Badge variant="secondary">{questionTypeLabel(item.type)}</Badge>
                <span className="text-sm font-normal text-muted-foreground">
                  {item.points} 分
                </span>
                {showResult ? (
                  <Badge variant={submissionItem.isCorrect ? 'default' : 'outline'}>
                    {submissionItem.isCorrect ? '正确' : '错误'}（
                    {submissionItem.pointsAwarded} 分）
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base text-foreground">{item.stem}</p>

              {item.type === 'MULTI' ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    多选题：须全部选对才得分（全对满分，否则 0 分）。
                  </p>
                  {item.options.map((opt) => {
                    const selected = parseMultiKeys(
                      answers[item.examQuestionId] ?? '',
                    );
                    const checked = selected.includes(opt.key);
                    return (
                      <div key={opt.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`${item.examQuestionId}-${opt.key}`}
                          checked={checked}
                          disabled={readOnly}
                          onCheckedChange={(v) =>
                            toggleMulti(item.examQuestionId, opt.key, v === true)
                          }
                        />
                        <Label
                          htmlFor={`${item.examQuestionId}-${opt.key}`}
                          className="text-base font-normal"
                        >
                          {opt.key}. {opt.text}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <RadioGroup
                  value={answers[item.examQuestionId] ?? ''}
                  onValueChange={(v) => updateAnswer(item.examQuestionId, v)}
                  disabled={readOnly}
                >
                  {item.options.map((opt) => (
                    <div key={opt.key} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={opt.key}
                        id={`${item.examQuestionId}-${opt.key}`}
                      />
                      <Label
                        htmlFor={`${item.examQuestionId}-${opt.key}`}
                        className="text-base font-normal"
                      >
                        {opt.key}. {opt.text}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!readOnly ? (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
          <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
            <AlertDialogTrigger asChild>
              <Button className="w-full max-w-3xl" size="lg">
                提交试卷
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认提交？</AlertDialogTitle>
                <AlertDialogDescription>
                  提交后无法修改答案，请确认已全部作答。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>再检查一下</AlertDialogCancel>
                <AlertDialogAction
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? '提交中…' : '确认提交'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </div>
  );
}

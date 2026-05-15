import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import {
  formatAnswerKeys,
  questionTypeLabel,
  truncateStem,
  type QuestionDetail,
} from '@/lib/qbank';

const MULTI_SCORING_COPY =
  '计分规则：全对满分，否则 0 分（选项须与正确答案完全一致，多选、少选、错选均不得分）。';

function parseAnswerKeyList(answerKeys: string): string[] {
  return answerKeys
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

type QuestionDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: QuestionDetail | null;
  loading: boolean;
};

export function QuestionDetailDialog({
  open,
  onOpenChange,
  detail,
  loading,
}: QuestionDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        {loading || !detail ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                <Badge variant="secondary">{questionTypeLabel(detail.type)}</Badge>
                <span className="line-clamp-2 text-base font-semibold">
                  {truncateStem(detail.stem, 40)}
                </span>
              </DialogTitle>
            </DialogHeader>
            <DetailBody detail={detail} />
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                关闭
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ detail }: { detail: QuestionDetail }) {
  const answerKeyList = parseAnswerKeyList(detail.answerKeys);
  const isMulti = detail.type === 'MULTI';

  return (
    <div className="space-y-4 text-base">
      <p className="whitespace-pre-wrap">{detail.stem}</p>
      <ul className="space-y-2">
        {[...detail.options]
          .sort((a, b) => a.key.localeCompare(b.key))
          .map((opt) => {
            const isAnswer = answerKeyList.includes(opt.key);
            return (
              <li
                key={opt.key}
                className={isAnswer ? 'font-semibold text-primary' : undefined}
              >
                {opt.key}. {opt.text}
              </li>
            );
          })}
      </ul>
      {isMulti && answerKeyList.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">正确答案</p>
          <AnswerBadges keys={answerKeyList} />
        </div>
      ) : (
        <p className="text-sm font-semibold">
          正确答案：{formatAnswerKeys(detail.answerKeys)}
        </p>
      )}
      <p className="text-muted-foreground">
        解析：{detail.explanation?.trim() ? detail.explanation : '—'}
      </p>
      {detail.knowledgePoints?.trim() ? (
        <p>知识点：{detail.knowledgePoints}</p>
      ) : null}
      <p className="text-sm font-semibold text-muted-foreground">
        分值 {detail.points} · 难度 {detail.difficulty}
      </p>
      {isMulti ? <MultiScoringBlock multiScoringRule={detail.multiScoringRule} /> : null}
    </div>
  );
}

function AnswerBadges({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {keys.map((key) => (
        <Badge key={key} variant="default">
          {key}
        </Badge>
      ))}
    </div>
  );
}

function MultiScoringBlock({
  multiScoringRule,
}: {
  multiScoringRule: QuestionDetail['multiScoringRule'];
}) {
  if (multiScoringRule === 'ALL_OR_NOTHING') {
    return <p className="text-sm text-muted-foreground">{MULTI_SCORING_COPY}</p>;
  }

  return (
    <Alert variant="destructive">
      <AlertDescription>
        警告：未返回计分规则字段（multiScoringRule），请联系管理员。
      </AlertDescription>
    </Alert>
  );
}

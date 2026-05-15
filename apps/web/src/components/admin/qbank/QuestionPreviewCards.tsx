import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatAnswerKeys,
  questionTypeLabel,
  type PreviewQuestion,
} from '@/lib/qbank';

function parseAnswerKeyList(answerKeys: string): string[] {
  return answerKeys
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

type QuestionPreviewCardsProps = {
  questions: PreviewQuestion[];
  compact?: boolean;
};

export function QuestionPreviewCards({
  questions,
  compact = false,
}: QuestionPreviewCardsProps) {
  return <PreviewGrid questions={questions} compact={compact} />;
}

function PreviewGrid({
  questions,
  compact,
}: {
  questions: PreviewQuestion[];
  compact: boolean;
}) {
  return (
    <div className="grid gap-4">
      {questions.slice(0, 3).map((q, index) => (
        <PreviewCard key={`${q.stem}-${index}`} q={q} compact={compact} />
      ))}
    </div>
  );
}

function PreviewCard({ q, compact }: { q: PreviewQuestion; compact: boolean }) {
  const isMulti = q.type === 'MULTI';
  const answerKeys = parseAnswerKeyList(q.answerKeys);

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{questionTypeLabel(q.type)}</Badge>
          {isMulti ? (
            <Badge variant="outline" className="text-xs">
              多选
            </Badge>
          ) : null}
        </div>
        <p
          className={
            compact
              ? 'line-clamp-3 text-base text-foreground'
              : 'text-base text-foreground'
          }
        >
          {q.stem}
        </p>
        {q.options && q.options.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {q.options.slice(0, compact ? 3 : undefined).map((opt) => (
              <li key={opt.key}>
                <span
                  className={
                    answerKeys.includes(opt.key)
                      ? 'font-semibold text-primary'
                      : undefined
                  }
                >
                  {opt.key}. {opt.text}
                </span>
              </li>
            ))}
            {compact && q.options.length > 3 ? (
              <li className="text-muted-foreground">…</li>
            ) : null}
          </ul>
        ) : null}
        {isMulti && answerKeys.length > 0 ? (
          <AnswerKeyBadges answerKeys={answerKeys} />
        ) : (
          <p className="text-sm font-semibold">
            正确答案：{formatAnswerKeys(q.answerKeys)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AnswerKeyBadges({ answerKeys }: { answerKeys: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold">正确答案</span>
      {answerKeys.map((key) => (
        <Badge key={key} variant="default">
          {key}
        </Badge>
      ))}
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatFillAnswerKeysPreview, parseFillBlankSpecs } from '@/lib/fillin';
import {
  formatAnswerKeys,
  formatStemForDisplay,
  questionTypeLabel,
  type PreviewQuestion,
} from '@/lib/qbank';
import { cn } from '@/lib/utils';

function parseAnswerKeyList(answerKeys: string): string[] {
  return answerKeys
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

type QuestionPreviewCardsProps = {
  questions: PreviewQuestion[];
  compact?: boolean;
  size?: 'default' | 'large';
};

export function QuestionPreviewCards({
  questions,
  compact = false,
  size = 'default',
}: QuestionPreviewCardsProps) {
  return <PreviewGrid questions={questions} compact={compact} size={size} />;
}

function PreviewGrid({
  questions,
  compact,
  size,
}: {
  questions: PreviewQuestion[];
  compact: boolean;
  size: 'default' | 'large';
}) {
  return (
    <div className="grid gap-4">
      {questions.slice(0, 3).map((q, index) => (
        <PreviewCard
          key={`${q.stem}-${index}`}
          q={q}
          compact={compact}
          size={size}
        />
      ))}
    </div>
  );
}

function PreviewCard({
  q,
  compact,
  size,
}: {
  q: PreviewQuestion;
  compact: boolean;
  size: 'default' | 'large';
}) {
  const isMulti = q.type === 'MULTI';
  const answerKeys = parseAnswerKeyList(q.answerKeys);
  const large = size === 'large';

  return (
    <Card>
      <CardContent className={cn('space-y-3 pt-6', large && 'space-y-4 pt-8')}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={large ? 'text-sm' : undefined}>
            {questionTypeLabel(q.type)}
          </Badge>
          {isMulti ? (
            <Badge variant="outline" className={large ? 'text-sm' : 'text-xs'}>
              多选
            </Badge>
          ) : null}
        </div>
        <p
          className={cn(
            'text-foreground',
            large
              ? 'text-2xl leading-relaxed'
              : compact
                ? 'line-clamp-3 text-base'
                : 'text-base',
          )}
        >
          {formatStemForDisplay(q.stem)}
        </p>
        {q.options && q.options.length > 0 ? (
          <ul
            className={cn(
              'space-y-1 text-muted-foreground',
              large ? 'space-y-2 text-lg' : 'text-sm',
            )}
          >
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
        {q.type === 'FILL' ? (
          <div
            className={cn(
              'space-y-1 text-muted-foreground',
              large ? 'space-y-2 text-lg' : 'text-sm',
            )}
          >
            <p>
              标准答案：{formatFillAnswerKeysPreview(q.answerKeys)}
            </p>
            <p className="tabular-nums">分值：{q.points} 分/空</p>
            {parseFillBlankSpecs(q.answerKeys).length > 1 ? (
              <ul className="list-inside list-disc">
                {parseFillBlankSpecs(q.answerKeys).map((blank) => (
                  <li key={blank.blankIndex}>
                    空 {blank.blankIndex}：{blank.answers.join(' / ')}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : isMulti && answerKeys.length > 0 ? (
          <AnswerKeyBadges answerKeys={answerKeys} large={large} />
        ) : (
          <p className={cn('font-semibold', large ? 'text-lg' : 'text-sm')}>
            正确答案：{formatAnswerKeys(q.answerKeys)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AnswerKeyBadges({
  answerKeys,
  large = false,
}: {
  answerKeys: string[];
  large?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn('font-semibold', large ? 'text-lg' : 'text-sm')}>
        正确答案
      </span>
      {answerKeys.map((key) => (
        <Badge key={key} variant="default">
          {key}
        </Badge>
      ))}
    </div>
  );
}

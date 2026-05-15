import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatAnswerKeys,
  questionTypeLabel,
  type PreviewQuestion,
} from '@/lib/qbank';

type QuestionPreviewCardsProps = {
  questions: PreviewQuestion[];
  compact?: boolean;
};

export function QuestionPreviewCards({
  questions,
  compact = false,
}: QuestionPreviewCardsProps) {
  return (
    <div className="grid gap-4">
      {questions.slice(0, 3).map((q, index) => (
        <Card key={`${q.stem}-${index}`}>
          <CardContent className="space-y-3 pt-6">
            <Badge variant="secondary">{questionTypeLabel(q.type)}</Badge>
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
                        q.answerKeys.split(',').includes(opt.key)
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
            <p className="text-sm font-semibold">
              正确答案：{formatAnswerKeys(q.answerKeys)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { BookOpen, ClipboardList, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PLACEHOLDER_CARDS = [
  { title: '题库', icon: BookOpen, href: '/admin/questions' as const },
  { title: '名单', icon: Users, href: '/admin/roster' as const },
  { title: '考试', icon: ClipboardList, href: '/admin/exams' as const },
] as const;

export default function AdminDashboard() {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
        {PLACEHOLDER_CARDS.map(({ title, icon: Icon, ...rest }) => {
          const href = 'href' in rest ? rest.href : undefined;
          const card = (
            <Card
              className={cn(
                'min-h-[11rem] sm:min-h-[12.5rem]',
                href
                  ? 'transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring'
                  : 'cursor-not-allowed opacity-60',
              )}
              {...(!href ? { 'aria-disabled': true } : {})}
            >
              <CardHeader className="flex flex-col items-center gap-5 space-y-0 p-8 text-center">
                <div
                  className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-muted sm:size-24"
                  aria-hidden
                >
                  <Icon className="size-10 text-muted-foreground sm:size-12" />
                </div>
                <CardTitle className="text-xl font-semibold sm:text-2xl">
                  {title}
                </CardTitle>
              </CardHeader>
              {!href ? (
                <CardContent className="px-8 pb-8 pt-0">
                  <span className="text-base font-semibold text-muted-foreground sm:text-lg">
                    即将开放
                  </span>
                </CardContent>
              ) : null}
            </Card>
          );

          if (href) {
            return (
              <Link key={title} to={href} className="rounded-xl outline-none">
                {card}
              </Link>
            );
          }

          return <div key={title}>{card}</div>;
        })}
    </div>
  );
}

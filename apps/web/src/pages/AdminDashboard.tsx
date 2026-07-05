import { BookOpen, ClipboardList, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { adminNavCardTitle } from '@/components/admin/admin-typography';
import { Card, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PLACEHOLDER_CARDS = [
  { title: '题库', icon: BookOpen, href: '/admin/questions' as const },
  { title: '名单', icon: Users, href: '/admin/roster' as const },
  { title: '考试', icon: ClipboardList, href: '/admin/exams' as const },
] as const;

export default function AdminDashboard() {
  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col justify-center py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {PLACEHOLDER_CARDS.map(({ title, icon: Icon, ...rest }) => {
          const href = 'href' in rest ? rest.href : undefined;
          const card = (
            <Card
              className={cn(
                'min-h-[14rem] sm:min-h-[16rem]',
                href
                  ? 'transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring'
                  : 'cursor-not-allowed opacity-60',
              )}
              {...(!href ? { 'aria-disabled': true } : {})}
            >
              <CardHeader className="flex h-full flex-col items-center justify-center gap-5 space-y-0 p-8 text-center">
                <div
                  className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-muted sm:size-24"
                  aria-hidden
                >
                  <Icon className="size-10 text-muted-foreground sm:size-11" />
                </div>
                <h2 className={adminNavCardTitle}>{title}</h2>
              </CardHeader>
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
    </div>
  );
}

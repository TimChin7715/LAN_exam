import { BookOpen, ClipboardList, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PLACEHOLDER_CARDS = [
  { title: '题库', icon: BookOpen, href: '/admin/questions' as const },
  { title: '名单', icon: Users, href: '/admin/roster' as const },
  { title: '考试', icon: ClipboardList, href: '/admin/exams' as const },
] as const;

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold leading-tight text-foreground">
          欢迎，{user?.displayName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          请导入题库与名单后创建考试。若从旧版考官账号环境升级，历史数据不会自动显示，需重新导入。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLACEHOLDER_CARDS.map(({ title, icon: Icon, ...rest }) => {
          const href = 'href' in rest ? rest.href : undefined;
          const card = (
            <Card
              className={cn(
                'min-h-[8.5rem]',
                href
                  ? 'transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring'
                  : 'cursor-not-allowed opacity-60',
              )}
              {...(!href ? { 'aria-disabled': true } : {})}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 p-6 pb-3">
                <CardTitle className="text-base font-semibold sm:text-lg">
                  {title}
                </CardTitle>
                <div
                  className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted sm:size-16"
                  aria-hidden
                >
                  <Icon className="size-8 text-muted-foreground sm:size-9" />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                {href ? (
                  <span className="text-sm font-semibold text-primary">进入</span>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    即将开放
                  </span>
                )}
              </CardContent>
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

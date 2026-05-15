import { BookOpen, ClipboardList, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const PLACEHOLDER_CARDS = [
  { title: '题库', icon: BookOpen, href: '/admin/questions' as const },
  { title: '名单', icon: Users, href: '/admin/roster' as const },
  { title: '考试', icon: ClipboardList },
] as const;

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold leading-tight text-foreground">
          欢迎，{user?.displayName}
        </h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">管理功能筹备中</h2>
        <p className="text-base text-muted-foreground">
          题库导入、名单管理与考试编排将在后续版本开放。当前阶段请确认您可正常登录并访问本页。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLACEHOLDER_CARDS.map(({ title, icon: Icon, ...rest }) => {
          const href = 'href' in rest ? rest.href : undefined;
          const card = (
            <Card
              className={cn(
                href
                  ? 'transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring'
                  : 'cursor-not-allowed opacity-60',
              )}
              {...(!href ? { 'aria-disabled': true } : {})}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                <Icon className="size-5 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
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

import { Spinner } from '@/components/ui/spinner';

export function AuthChecking() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
      <Spinner />
      <p className="text-base text-muted-foreground">正在验证登录状态…</p>
    </div>
  );
}

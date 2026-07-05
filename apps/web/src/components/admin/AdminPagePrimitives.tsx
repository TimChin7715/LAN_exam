import type { ComponentProps, ReactNode } from 'react';

import { AdminBackToConsoleButton } from '@/components/admin/AdminBackToConsoleButton';
import {
  adminPageDescription,
  adminPageTitle,
  adminSectionTitle,
} from '@/components/admin/admin-typography';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type AdminPageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  showBack?: boolean;
  className?: string;
};

export function AdminPageHeader({
  title,
  description,
  actions,
  showBack = true,
  className,
}: AdminPageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {showBack ? <AdminBackToConsoleButton /> : null}
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-4',
          !showBack && 'pt-0',
        )}
      >
        <div className="min-w-0 space-y-2">
          <h1 className={adminPageTitle}>{title}</h1>
          {description ? (
            <div className={adminPageDescription}>{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type AdminSectionCardProps = {
  title: ReactNode;
  children: ReactNode;
  headerExtra?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
};

export function AdminSectionCard({
  title,
  children,
  headerExtra,
  className,
  headerClassName,
  contentClassName,
  titleClassName,
}: AdminSectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader
        className={cn(
          'gap-2 p-6',
          headerExtra &&
            'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
          headerClassName,
        )}
      >
        <h3 className={cn(adminSectionTitle, titleClassName)}>{title}</h3>
        {headerExtra}
      </CardHeader>
      <CardContent className={cn('p-6 pt-0', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

type AdminDataTableProps = ComponentProps<typeof Table>;

export function AdminDataTable({ className, ...props }: AdminDataTableProps) {
  return <Table className={cn('text-base', className)} {...props} />;
}

export {
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};

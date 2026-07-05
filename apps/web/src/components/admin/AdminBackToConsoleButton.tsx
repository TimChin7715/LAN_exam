import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function AdminBackToConsoleButton() {
  return (
    <Button variant="outline" className="h-11 text-base" asChild>
      <Link to="/admin">
        <ArrowLeft className="size-5" aria-hidden />
        返回控制台
      </Link>
    </Button>
  );
}

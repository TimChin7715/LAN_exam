import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class StudentExamErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Student exam page crashed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh items-center justify-center bg-background px-4">
          <Alert variant="destructive" className="max-w-lg">
            <AlertDescription className="space-y-3">
              <p>
                答题页面出现异常，请刷新后重试。已自动保存的作答一般已同步至服务器。
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

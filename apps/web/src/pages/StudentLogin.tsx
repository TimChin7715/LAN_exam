import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { isValidNationalIdFormat } from '@/lib/national-id';
import {
  ApiError,
  STUDENT_AUTH_ERROR_MESSAGE,
  STUDENT_ID_FORMAT_ERROR_MESSAGE,
  studentApi,
} from '@/lib/student';

const loginSchema = z.object({
  fullName: z.string().trim().min(1, '请输入姓名'),
  nationalId: z
    .string()
    .trim()
    .min(1, '请输入身份证号')
    .max(18, '身份证号应为 18 位'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function StudentLogin() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { fullName: '', nationalId: '' },
  });

  const submitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    const fullName = values.fullName.trim();
    const nationalId = values.nationalId.trim();

    if (!isValidNationalIdFormat(nationalId)) {
      setFormError(STUDENT_ID_FORMAT_ERROR_MESSAGE);
      return;
    }

    try {
      await studentApi.verify(fullName, nationalId);
      navigate('/exam/waiting', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError(STUDENT_AUTH_ERROR_MESSAGE);
        return;
      }
      if (err instanceof ApiError && err.status === 400) {
        setFormError(err.message);
        return;
      }
      if (
        err instanceof TypeError ||
        (err instanceof ApiError && err.status >= 500)
      ) {
        setFormError(
          '无法连接考试服务。请联系监考教师确认系统已完整启动，或稍后刷新重试。',
        );
        return;
      }
      setFormError('无法连接服务器，请检查网络或联系机房管理员。');
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-[400px]">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle>考生登录</CardTitle>
          <CardDescription>局域网考试系统 · 请验证身份</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
            >
              {formError ? (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nationalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>身份证号</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        inputMode="text"
                        maxLength={18}
                        disabled={submitting}
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                进入考场准备
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

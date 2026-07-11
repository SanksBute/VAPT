import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Set a new SentinelX AI password',
};

export default function ResetPasswordPage(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-12 w-12 mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">SentinelX AI</h1>
          <p className="text-muted-foreground mt-1">Enterprise Security Platform</p>
        </div>

        <div className="glass-card rounded-xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Set a new password</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a strong password for your account
            </p>
          </div>
          <ResetPasswordForm />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security. All activity is logged and monitored.
        </p>
      </div>
    </div>
  );
}

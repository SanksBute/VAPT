import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Reset your SentinelX AI password',
};

export default function ForgotPasswordPage(): JSX.Element {
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
            <h2 className="text-xl font-semibold">Forgot your password?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email and we'll send you a reset link
            </p>
          </div>
          <ForgotPasswordForm />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security. All activity is logged and monitored.
        </p>
      </div>
    </div>
  );
}

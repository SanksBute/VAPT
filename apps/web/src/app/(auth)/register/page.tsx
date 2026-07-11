import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/register-form';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your SentinelX AI account',
};

export default function RegisterPage(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <Logo className="h-12 w-12 mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">SentinelX AI</h1>
          <p className="text-muted-foreground mt-1">Enterprise Security Platform</p>
        </div>

        {/* Register form */}
        <div className="glass-card rounded-xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Create your account</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Start securing your organization today
            </p>
          </div>
          <RegisterForm />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security. All activity is logged and monitored.
        </p>
      </div>
    </div>
  );
}

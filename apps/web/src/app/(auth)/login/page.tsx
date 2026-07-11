import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/ui/logo';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your SentinelX AI account',
};

export default function LoginPage(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <Logo className="h-12 w-12 mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">SentinelX AI</h1>
          <p className="text-muted-foreground mt-1">Enterprise Security Platform</p>
        </div>

        {/* Login form */}
        <div className="glass-card rounded-xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your security dashboard
            </p>
          </div>
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security. All activity is logged and monitored.
        </p>
      </div>
    </div>
  );
}

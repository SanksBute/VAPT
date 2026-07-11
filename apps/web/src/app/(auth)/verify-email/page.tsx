'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { apiGet, ApiError } from '@/lib/api-client';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage(): JSX.Element {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token. Please use the link from your email.');
      return;
    }

    apiGet<{ message: string }>('/auth/verify-email', { token })
      .then((result) => {
        setStatus('success');
        setMessage(result.message ?? 'Email verified successfully.');
      })
      .catch((err: unknown) => {
        setStatus('error');
        setMessage(
          err instanceof ApiError ? err.message : 'Verification failed. The link may have expired.',
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-12 w-12 mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">SentinelX AI</h1>
        </div>

        <div className="glass-card rounded-xl p-8 shadow-2xl text-center space-y-4">
          {status === 'verifying' && (
            <>
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Verifying your email...</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
              <h2 className="text-xl font-semibold">Email verified</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button className="w-full" asChild>
                <a href="/login">Continue to sign in</a>
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-10 w-10 mx-auto text-destructive" />
              <h2 className="text-xl font-semibold">Verification failed</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button variant="outline" className="w-full" asChild>
                <a href="/login">Back to sign in</a>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

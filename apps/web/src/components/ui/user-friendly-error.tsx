'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, HelpCircle, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useUxStore } from '@/store/ux.store';
import { cn } from '@/lib/utils';

interface UserFriendlyErrorProps {
  title?: string;
  message?: string;
  errorCode?: string;
  whatHappened?: string;
  whyItHappened?: string;
  howToFix?: string[];
  onRetry?: () => void;
  showHomeButton?: boolean;
  severity?: 'error' | 'warning' | 'info';
}

export function UserFriendlyError({
  title = 'Something went wrong',
  message,
  errorCode,
  whatHappened,
  whyItHappened,
  howToFix = [],
  onRetry,
  showHomeButton = true,
  severity = 'error',
}: UserFriendlyErrorProps): JSX.Element {
  const router = useRouter();
  const { openCopilot, isBeginnerMode } = useUxStore();

  const icons = {
    error: <AlertTriangle className="h-12 w-12 text-red-500" />,
    warning: <AlertTriangle className="h-12 w-12 text-amber-500" />,
    info: <HelpCircle className="h-12 w-12 text-blue-500" />,
  };

  const colors = {
    error: 'border-red-500/20 bg-red-500/5',
    warning: 'border-amber-500/20 bg-amber-500/5',
    info: 'border-blue-500/20 bg-blue-500/5',
  };

  return (
    <Card className={cn('border-2 max-w-lg mx-auto', colors[severity])}>
      <CardContent className="pt-8 pb-6">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">{icons[severity]}</div>
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          {message && (
            <p className="text-muted-foreground text-sm">{message}</p>
          )}
          {errorCode && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Error code: {errorCode}
            </p>
          )}
        </div>

        {isBeginnerMode() && (whatHappened || whyItHappened || howToFix.length > 0) && (
          <div className="space-y-3 mb-6">
            {whatHappened && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-1">❓ What happened?</p>
                <p className="text-sm">{whatHappened}</p>
              </div>
            )}
            {whyItHappened && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-1">🔍 Why did this happen?</p>
                <p className="text-sm">{whyItHappened}</p>
              </div>
            )}
            {howToFix.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-2">🛠️ How to fix it:</p>
                <ol className="space-y-1.5">
                  {howToFix.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="gap-2 flex-1">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          {showHomeButton && (
            <Button variant="outline" onClick={() => router.push('/dashboard')} className="gap-2 flex-1">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => openCopilot({ page: 'error' })}
            className="gap-2 flex-1"
          >
            <HelpCircle className="h-4 w-4" />
            Ask AI for Help
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// For Next.js error.tsx files
interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorPage({ error, reset }: ErrorPageProps): JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <UserFriendlyError
        title="Something went wrong"
        message="An unexpected error occurred. Don't worry — your data is safe."
        errorCode={error.digest}
        whatHappened="The page you were trying to load encountered an error."
        whyItHappened="This could be due to a temporary network issue, a bug in our system, or an expired session."
        howToFix={[
          'Click "Try Again" to reload the page',
          'Clear your browser cache and reload',
          'If the problem persists, sign out and sign back in',
          'Contact support if nothing works',
        ]}
        onRetry={reset}
        severity="error"
      />
    </div>
  );
}

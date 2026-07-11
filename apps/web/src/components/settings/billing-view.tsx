'use client';

import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CreditCard, Loader2, Check } from 'lucide-react';
import { apiGet, apiPost, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  tier: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  invoicePdfUrl?: string | null;
}

interface Subscription {
  id: string;
  status: string;
  billingInterval: string;
  currentPeriodEnd: string;
  plan: Plan;
  invoices: Invoice[];
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function BillingView(): JSX.Element {
  const { data: subscription, isLoading: loadingSub } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => apiGet<Subscription | null>('/billing/subscription'),
  });

  const { data: plans, isLoading: loadingPlans } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => apiGet<Plan[]>('/billing/plans'),
  });

  const checkout = useMutation({
    mutationFn: (planName: string) =>
      apiPost<{ url: string }>('/billing/checkout', { planName, billingInterval: 'MONTHLY' }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not start checkout.');
    },
  });

  if (loadingSub || loadingPlans) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Current plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{subscription.plan.displayName}</span>
                  <Badge variant="secondary" className="text-xs">{subscription.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {subscription.billingInterval.charAt(0) + subscription.billingInterval.slice(1).toLowerCase()}{' '}
                  billing · renews {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No active subscription.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Available plans</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(plans ?? []).map((plan) => {
              const isCurrent = subscription?.plan.id === plan.id;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    'rounded-lg border p-4 flex flex-col gap-3',
                    isCurrent ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{plan.displayName}</span>
                      {isCurrent && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                    )}
                  </div>
                  <div className="text-2xl font-bold">
                    {formatMoney(plan.monthlyPrice, plan.currency)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                  <Button
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || checkout.isPending}
                    onClick={() => checkout.mutate(plan.name)}
                    className="gap-2 mt-auto"
                  >
                    {checkout.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isCurrent ? 'Current plan' : 'Upgrade'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {subscription && subscription.invoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Billing history</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subscription.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div>
                    <p className="text-sm font-medium">Invoice {invoice.number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{formatMoney(invoice.amount, invoice.currency)}</span>
                    <Badge variant="secondary" className="text-xs">{invoice.status}</Badge>
                    {invoice.invoicePdfUrl && (
                      <a
                        href={invoice.invoicePdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

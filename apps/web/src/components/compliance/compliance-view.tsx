'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatRelativeTime } from '@/lib/utils';

interface ComplianceSummaryItem {
  framework: string;
  name: string;
  latestScore: number | null;
  latestStatus: string;
  lastAssessed: string | null;
}

interface ComplianceProfile {
  id: string;
  framework: string;
  name: string;
  isActive: boolean;
  _count?: { controls: number; assessments: number };
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
}

export function ComplianceView(): JSX.Element {
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['compliance', 'summary'],
    queryFn: () => apiGet<ComplianceSummaryItem[]>('/compliance/summary'),
  });

  const { data: profiles } = useQuery({
    queryKey: ['compliance', 'profiles'],
    queryFn: () => apiGet<ComplianceProfile[]>('/compliance/profiles'),
  });

  const assess = useMutation({
    mutationFn: (profileId: string) =>
      apiPost(`/compliance/profiles/${profileId}/assess`),
    onSuccess: () => {
      toast.success('Assessment started — results will update shortly.');
      void queryClient.invalidateQueries({ queryKey: ['compliance'] });
    },
    onError: () => toast.error('Could not start the assessment. Please try again.'),
  });

  const profileByFramework = new Map(
    (profiles ?? []).map((p) => [p.framework, p]),
  );

  if (loadingSummary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(summary ?? []).map((item) => {
        const profile = profileByFramework.get(item.framework);
        const score = item.latestScore;
        return (
          <Card key={item.framework}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {item.name}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {item.latestStatus?.replace(/_/g, ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className={cn('text-3xl font-bold', scoreColor(score))}>
                    {score !== null ? `${Math.round(score)}%` : '—'}
                  </span>
                  {score !== null &&
                    (score >= 80 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ))}
                </div>
                <Progress value={score ?? 0} className="mt-2 h-2" />
              </div>
              <p className="text-xs text-muted-foreground">
                {item.lastAssessed
                  ? `Last assessed ${formatRelativeTime(item.lastAssessed)}`
                  : 'Not assessed yet'}
              </p>
              {profile && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={assess.isPending}
                  onClick={() => assess.mutate(profile.id)}
                >
                  {assess.isPending && assess.variables === profile.id ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Assessing…
                    </>
                  ) : (
                    'Run Assessment'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

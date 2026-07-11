'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { apiGet } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface ComplianceStatus {
  framework: string;
  name: string;
  latestScore: number | null;
  latestStatus: string;
  lastAssessed: string | null;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    COMPLIANT: 'text-green-500',
    NON_COMPLIANT: 'text-red-500',
    PARTIALLY_COMPLIANT: 'text-amber-500',
    UNDER_REVIEW: 'text-blue-500',
    NOT_APPLICABLE: 'text-muted-foreground',
  };
  return colors[status] ?? 'text-muted-foreground';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    COMPLIANT: 'Compliant',
    NON_COMPLIANT: 'Non-Compliant',
    PARTIALLY_COMPLIANT: 'Partial',
    UNDER_REVIEW: 'Under Review',
    NOT_APPLICABLE: 'N/A',
  };
  return labels[status] ?? status;
}

export function ComplianceSummary(): JSX.Element {
  const { data = [], isLoading } = useQuery<ComplianceStatus[]>({
    queryKey: ['compliance', 'summary'],
    queryFn: () => apiGet<ComplianceStatus[]>('/compliance/summary'),
    refetchInterval: 300000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Compliance Status</CardTitle>
          <CardDescription>Active framework compliance overview</CardDescription>
        </div>
        <Link href="/compliance" className="text-xs text-primary hover:underline">
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No compliance frameworks configured.{' '}
            <Link href="/compliance" className="text-primary hover:underline">
              Add one
            </Link>
          </p>
        ) : (
          <div className="space-y-4">
            {data.map((item) => (
              <div key={item.framework} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.framework.replace(/_/g, ' ')}</span>
                  <span className={cn('text-xs font-medium', getStatusColor(item.latestStatus))}>
                    {getStatusLabel(item.latestStatus)}
                  </span>
                </div>
                <Progress
                  value={item.latestScore ?? 0}
                  className="h-1.5"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{item.latestScore !== null ? `${Math.round(item.latestScore)}%` : 'Not assessed'}</span>
                  {item.lastAssessed && (
                    <span>
                      Last: {new Date(item.lastAssessed).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

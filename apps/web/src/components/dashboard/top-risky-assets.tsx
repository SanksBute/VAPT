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

interface RiskyAsset {
  id: string;
  name: string;
  type: string;
  criticality: string;
  riskScore: number;
  _count: { vulnerabilities: number };
}

function getCriticalityColor(criticality: string): string {
  const colors: Record<string, string> = {
    CRITICAL: 'text-red-500',
    HIGH: 'text-orange-500',
    MEDIUM: 'text-amber-500',
    LOW: 'text-blue-500',
    INFORMATIONAL: 'text-slate-400',
  };
  return colors[criticality] ?? 'text-slate-400';
}

export function TopRiskyAssets(): JSX.Element {
  const { data = [], isLoading } = useQuery<RiskyAsset[]>({
    queryKey: ['dashboard', 'top-risky-assets'],
    queryFn: () => apiGet<RiskyAsset[]>('/dashboards/top-risky-assets', { limit: 8 }),
    refetchInterval: 120000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Top Risky Assets</CardTitle>
          <CardDescription>Assets with highest risk scores</CardDescription>
        </div>
        <Link href="/assets" className="text-xs text-primary hover:underline">
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-2 w-full" />
                </div>
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No assets found.</p>
        ) : (
          <div className="space-y-3">
            {data.map((asset) => (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="block hover:bg-muted/50 rounded-md p-2 -mx-2 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{asset.name}</span>
                    <Badge variant="outline" className="text-xs px-1">
                      {asset.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-xs font-medium', getCriticalityColor(asset.criticality))}>
                      {asset.criticality}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground">
                      {Math.round(asset.riskScore)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={asset.riskScore} className="h-1 flex-1" />
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {asset._count.vulnerabilities} vulns
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

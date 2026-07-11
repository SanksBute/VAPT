'use client';
import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { formatRelativeTime, getStatusBadgeClass, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ScansTable(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['scans'],
    queryFn: () => apiGet<{ items: Array<{ id: string; name: string; status: string; scanType: string; findings: number; criticalCount: number; createdAt: string }> }>('/scans', { limit: 25 }),
    refetchInterval: 15000,
  });
  if (isLoading) return <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          {data?.items.map((scan) => (
            <Link key={scan.id} href={`/scans/${scan.id}`} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 border border-border">
              <div>
                <p className="font-medium text-sm">{scan.name}</p>
                <p className="text-xs text-muted-foreground">{scan.scanType} · {formatRelativeTime(scan.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                {scan.criticalCount > 0 && <Badge variant="destructive" className="text-xs">{scan.criticalCount} critical</Badge>}
                <Badge className={cn('text-xs border', getStatusBadgeClass(scan.status))}>{scan.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatRelativeTime, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Scan, CheckCircle2, XCircle, Clock, Loader2, PauseCircle } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface RecentScan {
  id: string;
  name: string;
  status: string;
  scanType: string;
  findings: number;
  criticalCount: number;
  createdAt: string;
}

function StatusIcon({ status }: { status: string }): JSX.Element {
  const icons: Record<string, JSX.Element> = {
    COMPLETED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    FAILED: <XCircle className="h-4 w-4 text-red-500" />,
    RUNNING: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    INITIALIZING: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    PENDING: <Clock className="h-4 w-4 text-muted-foreground" />,
    QUEUED: <Clock className="h-4 w-4 text-muted-foreground" />,
    CANCELLED: <PauseCircle className="h-4 w-4 text-orange-500" />,
    PAUSED: <PauseCircle className="h-4 w-4 text-amber-500" />,
  };
  return icons[status] ?? <Scan className="h-4 w-4 text-muted-foreground" />;
}

export function RecentScans(): JSX.Element {
  const { data, isLoading } = useQuery<{ items: RecentScan[] }>({
    queryKey: ['scans', 'recent'],
    queryFn: () => apiGet<{ items: RecentScan[] }>('/scans', { limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Scans</CardTitle>
          <CardDescription>Latest security scan activities</CardDescription>
        </div>
        <Link href="/scans" className="text-xs text-primary hover:underline">
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : data?.items.length === 0 ? (
          <div className="text-center py-8">
            <Scan className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No scans yet.</p>
            <Link href="/scans/new" className="text-primary text-sm hover:underline mt-1 block">
              Start your first scan →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {data?.items.map((scan) => (
              <Link
                key={scan.id}
                href={`/scans/${scan.id}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <StatusIcon status={scan.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {scan.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {scan.scanType.replace(/_/g, ' ')} · {formatRelativeTime(scan.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {scan.criticalCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {scan.criticalCount} critical
                    </Badge>
                  )}
                  {scan.findings > 0 && scan.criticalCount === 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {scan.findings} findings
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

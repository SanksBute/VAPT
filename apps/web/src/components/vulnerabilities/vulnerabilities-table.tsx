'use client';
import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getSeverityBadgeClass, cn, formatRelativeTime } from '@/lib/utils';
export function VulnerabilitiesTable(): JSX.Element {
  const { data } = useQuery({ queryKey: ['vulnerabilities'], queryFn: () => apiGet<{ items: Array<{ id: string; title: string; severity: string; status: string; cvssV3Score: number | null; cveIds: string[]; firstDetectedAt: string }> }>('/vulnerabilities', { limit: 25 }) });
  return (
    <Card><CardContent className="pt-6"><div className="space-y-2">{data?.items.map((v) => (
      <Link key={v.id} href={`/vulnerabilities/${v.id}`} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 border border-border">
        <div className="min-w-0 flex-1"><p className="font-medium text-sm truncate">{v.title}</p><p className="text-xs text-muted-foreground">{v.cveIds[0] ?? ''} · {formatRelativeTime(v.firstDetectedAt)}</p></div>
        <div className="flex items-center gap-2 flex-shrink-0"><Badge className={cn('text-xs border', getSeverityBadgeClass(v.severity))}>{v.severity}</Badge>{v.cvssV3Score && <span className="text-xs text-muted-foreground">{v.cvssV3Score.toFixed(1)}</span>}</div>
      </Link>
    ))}</div></CardContent></Card>
  );
}

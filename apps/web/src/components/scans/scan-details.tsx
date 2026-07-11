'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getStatusBadgeClass, cn } from '@/lib/utils';
export function ScanDetails({ scanId }: { scanId: string }): JSX.Element {
  const { data } = useQuery({ queryKey: ['scan', scanId], queryFn: () => apiGet<{ name: string; status: string; scanType: string; findings: number; criticalCount: number; startedAt: string | null }>(`/scans/${scanId}`) });
  return (
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold">{data?.name ?? 'Scan Details'}</h1><p className="text-muted-foreground">{data?.scanType?.replace(/_/g, ' ')}</p></div>
      {data && <Badge className={cn('border', getStatusBadgeClass(data.status))}>{data.status}</Badge>}
    </div>
  );
}

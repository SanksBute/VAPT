'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
export function ScanProgress({ scanId }: { scanId: string }): JSX.Element {
  const { data } = useQuery({ queryKey: ['scan', scanId, 'progress'], queryFn: () => apiGet<{ progress: number; status: string; findings: number }>(`/scans/${scanId}/progress`), refetchInterval: 5000 });
  return (
    <Card><CardHeader><CardTitle className="text-sm">Progress</CardTitle></CardHeader><CardContent className="space-y-2">
      <Progress value={data?.progress ?? 0} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground"><span>{data?.progress ?? 0}% complete</span><span>{data?.findings ?? 0} findings</span></div>
    </CardContent></Card>
  );
}

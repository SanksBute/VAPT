'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export function ScanStatCards(): JSX.Element {
  const { data } = useQuery({ queryKey: ['scans', 'statistics'], queryFn: () => apiGet('/scans/statistics') });
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {['Total', 'Running', 'Completed', 'Failed'].map((s) => (
        <Card key={s}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s} Scans</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">—</div></CardContent></Card>
      ))}
    </div>
  );
}

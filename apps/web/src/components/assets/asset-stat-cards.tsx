'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export function AssetStatCards(): JSX.Element {
  const { data } = useQuery({ queryKey: ['assets', 'statistics'], queryFn: () => apiGet<{ total: number; byType: Record<string, number> }>('/assets/statistics') });
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Assets</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.total ?? 0}</div></CardContent></Card>
    </div>
  );
}

'use client';
import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
export function AssetsTable(): JSX.Element {
  const { data } = useQuery({ queryKey: ['assets'], queryFn: () => apiGet<{ items: Array<{ id: string; name: string; type: string; status: string; criticality: string; riskScore: number; ipAddresses: string[] }> }>('/assets', { limit: 25 }) });
  return (
    <Card><CardContent className="pt-6"><div className="space-y-2">{data?.items.map((a) => (
      <Link key={a.id} href={`/assets/${a.id}`} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 border border-border">
        <div><p className="font-medium text-sm">{a.name}</p><p className="text-xs text-muted-foreground">{a.type.replace(/_/g,' ')} · {a.ipAddresses[0] ?? ''}</p></div>
        <div className="flex items-center gap-2"><Badge variant="outline">{a.criticality}</Badge><span className="text-sm font-medium">{Math.round(a.riskScore)}</span></div>
      </Link>
    ))}</div></CardContent></Card>
  );
}

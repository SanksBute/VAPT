'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export function ScanFindings({ scanId }: { scanId: string }): JSX.Element {
  return (
    <Card><CardHeader><CardTitle>Findings</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Vulnerability findings from scan {scanId}</p></CardContent></Card>
  );
}

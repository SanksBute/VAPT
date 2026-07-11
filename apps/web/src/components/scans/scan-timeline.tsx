'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export function ScanTimeline({ scanId }: { scanId: string }): JSX.Element {
  return (
    <Card><CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Scan events and timeline</p></CardContent></Card>
  );
}

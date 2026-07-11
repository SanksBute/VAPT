'use client';
import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
export function ScansHeader(): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold">Scans</h1><p className="text-muted-foreground">Manage and monitor security scans</p></div>
      <Button asChild><Link href="/scans/new"><Plus className="h-4 w-4 mr-2" />New Scan</Link></Button>
    </div>
  );
}

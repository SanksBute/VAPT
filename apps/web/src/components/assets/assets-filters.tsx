'use client';
import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
export function AssetsFilters(): JSX.Element {
  return (
    <div className="flex items-center gap-2"><div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search assets, IPs, hostnames..." className="pl-9" /></div></div>
  );
}

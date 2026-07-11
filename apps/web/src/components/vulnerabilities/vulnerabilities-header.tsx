'use client';
import React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function VulnerabilitiesHeader(): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold">Vulnerabilities</h1><p className="text-muted-foreground">Track, prioritize, and remediate security vulnerabilities</p></div>
      <Button variant="outline"><FileText className="h-4 w-4 mr-2" />Export</Button>
    </div>
  );
}

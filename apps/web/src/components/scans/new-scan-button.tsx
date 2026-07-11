'use client';

import React from 'react';
import { Play, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useUxStore } from '@/store/ux.store';
import { useAuthStore } from '@/store/auth.store';
import { PERMISSIONS } from '@sentinelx/shared';
import Link from 'next/link';

export function NewScanButton(): JSX.Element {
  const { openScanWizard } = useUxStore();
  const { hasPermission } = useAuthStore();

  if (!hasPermission(PERMISSIONS.SCANS_CREATE)) return <></>;

  return (
    <div className="flex items-center gap-1">
      <Button onClick={openScanWizard} className="gap-2">
        <Play className="h-4 w-4" />
        New Scan
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Quick Scans</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { label: '🌐 My Website', desc: 'Scan a public website', type: 'WEB_APPLICATION' },
            { label: '🔍 Quick Discovery', desc: 'Find open ports fast', type: 'DISCOVERY' },
            { label: '🛡️ Full Vulnerability Scan', desc: 'Comprehensive check', type: 'VULNERABILITY_ASSESSMENT' },
            { label: '☁️ Cloud Security', desc: 'AWS/Azure/GCP scan', type: 'CLOUD_SECURITY' },
            { label: '💻 Source Code', desc: 'SAST code analysis', type: 'CODE_ANALYSIS' },
          ].map((preset) => (
            <DropdownMenuItem key={preset.type} onClick={openScanWizard} className="flex flex-col items-start gap-0">
              <span className="font-medium text-sm">{preset.label}</span>
              <span className="text-xs text-muted-foreground">{preset.desc}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/scans/schedule">⏰ Schedule Recurring Scan</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

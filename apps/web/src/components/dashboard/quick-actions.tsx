'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Play, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth.store';
import { PERMISSIONS } from '@sentinelx/shared';

export function QuickActions(): JSX.Element {
  const { hasPermission } = useAuthStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Quick Action
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {hasPermission(PERMISSIONS.SCANS_CREATE) && (
          <DropdownMenuItem asChild>
            <Link href="/scans/new" className="flex items-center gap-2">
              <Play className="h-4 w-4" /> New Scan
            </Link>
          </DropdownMenuItem>
        )}
        {hasPermission(PERMISSIONS.REPORTS_CREATE) && (
          <DropdownMenuItem asChild>
            <Link href="/reports/new" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Generate Report
            </Link>
          </DropdownMenuItem>
        )}
        {hasPermission(PERMISSIONS.TICKETS_CREATE) && (
          <DropdownMenuItem asChild>
            <Link href="/tickets/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> New Ticket
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

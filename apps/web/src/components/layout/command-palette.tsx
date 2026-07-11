'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useCommandPalette } from '@/store/command-palette.store';
import {
  LayoutDashboard, Shield, Scan, Server, AlertTriangle, FileText,
  CheckSquare, Brain, Settings, Plus, Search,
} from 'lucide-react';

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void;
  group: string;
  keywords?: string[];
}

const COMMANDS: CommandAction[] = [
  // Navigation
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', group: 'Navigation' },
  { id: 'scans', label: 'Scans', icon: Scan, href: '/scans', group: 'Navigation' },
  { id: 'vulnerabilities', label: 'Vulnerabilities', icon: AlertTriangle, href: '/vulnerabilities', group: 'Navigation' },
  { id: 'assets', label: 'Assets', icon: Server, href: '/assets', group: 'Navigation' },
  { id: 'ai-copilot', label: 'AI Copilot', icon: Brain, href: '/ai-copilot', group: 'Navigation' },
  { id: 'compliance', label: 'Compliance', icon: CheckSquare, href: '/compliance', group: 'Navigation' },
  { id: 'reports', label: 'Reports', icon: FileText, href: '/reports', group: 'Navigation' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings', group: 'Navigation' },

  // Actions
  { id: 'new-scan', label: 'New Scan', description: 'Start a new security scan', icon: Plus, href: '/scans/new', group: 'Actions', keywords: ['create scan', 'run scan'] },
  { id: 'generate-report', label: 'Generate Report', description: 'Create a security report', icon: FileText, href: '/reports/new', group: 'Actions', keywords: ['create report'] },
];

export function CommandPalette(): JSX.Element {
  const { isOpen, close } = useCommandPalette();
  const [search, setSearch] = useState('');
  const router = useRouter();

  const handleSelect = useCallback(
    (command: CommandAction): void => {
      close();
      setSearch('');
      if (command.href) {
        router.push(command.href);
      } else if (command.action) {
        command.action();
      }
    },
    [close, router],
  );

  const filteredCommands = COMMANDS.filter((cmd) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.keywords?.some((k) => k.includes(query))
    );
  });

  const groups = [...new Set(filteredCommands.map((c) => c.group))];

  return (
    <CommandDialog open={isOpen} onOpenChange={close}>
      <CommandInput
        placeholder="Search commands, pages, assets..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group) => (
          <React.Fragment key={group}>
            <CommandGroup heading={group}>
              {filteredCommands
                .filter((cmd) => cmd.group === group)
                .map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <CommandItem
                      key={cmd.id}
                      value={`${cmd.label} ${cmd.description ?? ''} ${cmd.keywords?.join(' ') ?? ''}`}
                      onSelect={() => handleSelect(cmd)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{cmd.label}</span>
                      {cmd.description && (
                        <span className="ml-2 text-xs text-muted-foreground">{cmd.description}</span>
                      )}
                    </CommandItem>
                  );
                })}
            </CommandGroup>
            <CommandSeparator />
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

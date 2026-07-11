'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search, Moon, Sun, Command, Brain, HelpCircle, Play } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth.store';
import { useCommandPalette } from '@/store/command-palette.store';
import { useUxStore } from '@/store/ux.store';
import { EducationModeToggle } from '@/components/ui/page-header';
import { generateAvatarFallback } from '@/lib/utils';
import { useUnreadNotifications } from '@/hooks/use-notifications';
import { useHasHydrated } from '@/hooks/use-hydrated';

export function AppHeader(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const { open: openCommandPalette } = useCommandPalette();
  const { data: unreadCount = 0 } = useUnreadNotifications();
  const { openCopilot, openHelp, openScanWizard, isBeginnerMode } = useUxStore();
  const pathname = usePathname();
  const hasHydrated = useHasHydrated();

  // Persisted auth/UX state isn't safe to read until after hydration —
  // fall back to the same defaults the server rendered until then.
  const effectiveUser = hasHydrated ? user : null;
  const beginnerMode = hasHydrated ? isBeginnerMode() : true;

  const pageContext = pathname.split('/')[1] ?? 'dashboard';

  const handleLogout = async (): Promise<void> => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-6">
      {/* Breadcrumb */}
      <div className="flex-1">
        <Breadcrumb />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Education mode toggle — only show in beginner mode or always show */}
        <div className="hidden md:block">
          <EducationModeToggle />
        </div>

        {/* Quick scan button (beginner mode) */}
        {beginnerMode && (
          <Button size="sm" className="h-8 gap-1.5 hidden sm:flex" onClick={openScanWizard}>
            <Play className="h-3.5 w-3.5" />
            New Scan
          </Button>
        )}

        {/* Command palette trigger */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground h-8 px-2"
          onClick={openCommandPalette}
        >
          <Search className="h-4 w-4" />
          <span className="text-xs hidden sm:block">Search</span>
          <kbd className="hidden sm:flex items-center gap-1 px-1.5 h-5 rounded border border-border bg-muted text-[10px] font-medium">
            <Command className="h-3 w-3" />K
          </kbd>
        </Button>

        {/* Help button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openHelp(pageContext)}
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Help & Documentation</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* AI Copilot */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openCopilot({ page: pageContext })}
              >
                <Brain className="h-4 w-4 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI Security Assistant</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={effectiveUser?.avatarUrl} />
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {effectiveUser
                    ? generateAvatarFallback(effectiveUser.firstName ?? '', effectiveUser.lastName ?? '')
                    : 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm font-medium">
                {effectiveUser?.firstName} {effectiveUser?.lastName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{effectiveUser?.firstName} {effectiveUser?.lastName}</span>
                <span className="text-xs text-muted-foreground">{effectiveUser?.email}</span>
                <span className="text-xs text-primary mt-0.5">{effectiveUser?.role?.replace(/_/g, ' ')}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/profile">Profile & Settings</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/settings/billing">Billing & Plan</a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openHelp('dashboard')}>
              Help Center
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => void handleLogout()}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

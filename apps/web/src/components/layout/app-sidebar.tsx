'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Shield,
  Scan,
  Server,
  AlertTriangle,
  FileText,
  CheckSquare,
  Brain,
  TrendingUp,
  Bell,
  Settings,
  Puzzle,
  Cloud,
  GitBranch,
  Package,
  ChevronRight,
  ChevronLeft,
  Search,
  Activity,
  Globe,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/auth.store';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'default' | 'destructive' | 'warning';
  permission?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Asset Discovery',
    href: '/assets',
    icon: Server,
  },
  {
    label: 'Scans',
    href: '/scans',
    icon: Scan,
    permission: 'scans:view',
  },
  {
    label: 'Vulnerabilities',
    href: '/vulnerabilities',
    icon: AlertTriangle,
    permission: 'vulns:view',
  },
  {
    label: 'Penetration Testing',
    href: '/pentests',
    icon: Shield,
    permission: 'scans:view',
  },
  {
    label: 'Web Application',
    href: '/web-security',
    icon: Globe,
    permission: 'scans:view',
  },
  {
    label: 'API Security',
    href: '/api-security',
    icon: Key,
    permission: 'scans:view',
  },
  {
    label: 'Cloud Security',
    href: '/cloud-security',
    icon: Cloud,
    permission: 'scans:view',
  },
  {
    label: 'Container Security',
    href: '/container-security',
    icon: Package,
    permission: 'scans:view',
  },
  {
    label: 'Source Code',
    href: '/source-code',
    icon: GitBranch,
    permission: 'scans:view',
  },
  {
    label: 'AI Copilot',
    href: '/ai-copilot',
    icon: Brain,
    permission: 'ai:use',
    badge: 'AI',
  },
  {
    label: 'Threat Intelligence',
    href: '/threat-intel',
    icon: Activity,
  },
  {
    label: 'Compliance',
    href: '/compliance',
    icon: CheckSquare,
    permission: 'compliance:view',
  },
  {
    label: 'Risk Management',
    href: '/risk',
    icon: TrendingUp,
    permission: 'risk:view',
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: FileText,
    permission: 'reports:view',
  },
  {
    label: 'Marketplace',
    href: '/marketplace',
    icon: Puzzle,
  },
];

const bottomNavItems: NavItem[] = [
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function AppSidebar(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { hasPermission } = useAuthStore();

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

  const filteredNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col border-r border-border bg-card/50 overflow-hidden flex-shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 h-14 border-b border-border">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <Logo className="h-7 w-7" />
              <span className="font-bold text-sm tracking-tight">SentinelX AI</span>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && <Logo className="h-7 w-7" />}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        <TooltipProvider delayDuration={0}>
          {filteredNavItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} isActive={isActive(item.href)} />
          ))}
        </TooltipProvider>
      </nav>

      {/* Bottom navigation */}
      <div className="border-t border-border py-4 space-y-1 px-2">
        <TooltipProvider delayDuration={0}>
          {bottomNavItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} isActive={isActive(item.href)} />
          ))}
        </TooltipProvider>
      </div>
    </motion.aside>
  );
}

function NavLink({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}): JSX.Element {
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-primary/10 text-primary',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex-1 truncate"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && item.badge && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
          {item.badge}
        </Badge>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

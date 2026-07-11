'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  scans: 'Scans',
  vulnerabilities: 'Vulnerabilities',
  assets: 'Assets',
  'ai-copilot': 'AI Copilot',
  compliance: 'Compliance',
  reports: 'Reports',
  tickets: 'Tickets',
  settings: 'Settings',
  profile: 'Profile',
  risk: 'Risk Management',
  'threat-intel': 'Threat Intelligence',
  marketplace: 'Marketplace',
  billing: 'Billing',
  pentests: 'Penetration Testing',
  'web-security': 'Web Application Security',
  'api-security': 'API Security',
  'cloud-security': 'Cloud Security',
  'container-security': 'Container Security',
  'source-code': 'Source Code Analysis',
  notifications: 'Notifications',
};

export function Breadcrumb(): JSX.Element {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return <></>;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/dashboard" className="hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>

      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/');
        const label = ROUTE_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
        const isLast = index === segments.length - 1;

        return (
          <React.Fragment key={href}>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            {isLast ? (
              <span className="text-foreground font-medium truncate max-w-[200px]">{label}</span>
            ) : (
              <Link
                href={href}
                className="hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

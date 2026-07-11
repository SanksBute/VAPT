'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, AlertTriangle, Server, Scan, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface OverviewData {
  assets: { total: number };
  vulnerabilities: { critical: number; high: number; medium: number; low: number; total: number };
  openTickets: number;
  averageRiskScore: number;
  recentScans: Array<{ id: string; name: string; status: string; findings: number }>;
}

interface StatCard {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  variant?: 'default' | 'critical' | 'warning' | 'success';
}

export function DashboardOverview(): JSX.Element {
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => apiGet<OverviewData>('/dashboards/overview'),
    refetchInterval: 60000,
  });

  const stats: StatCard[] = data
    ? [
        {
          label: 'Total Assets',
          value: data.assets.total.toLocaleString(),
          icon: Server,
          variant: 'default',
        },
        {
          label: 'Critical Vulnerabilities',
          value: data.vulnerabilities.critical.toLocaleString(),
          subValue: `${data.vulnerabilities.total.toLocaleString()} total`,
          icon: AlertTriangle,
          variant: data.vulnerabilities.critical > 0 ? 'critical' : 'success',
        },
        {
          label: 'Risk Score',
          value: `${Math.round(data.averageRiskScore)}/100`,
          icon: Shield,
          variant: data.averageRiskScore >= 70 ? 'critical' : data.averageRiskScore >= 40 ? 'warning' : 'success',
        },
        {
          label: 'Open Tickets',
          value: data.openTickets.toLocaleString(),
          icon: Scan,
          variant: 'default',
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.label}
            className={cn(
              'border transition-colors',
              stat.variant === 'critical' && 'border-red-500/30 bg-red-500/5',
              stat.variant === 'warning' && 'border-amber-500/30 bg-amber-500/5',
              stat.variant === 'success' && 'border-green-500/30 bg-green-500/5',
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <Icon
                className={cn(
                  'h-4 w-4',
                  stat.variant === 'critical' && 'text-red-500',
                  stat.variant === 'warning' && 'text-amber-500',
                  stat.variant === 'success' && 'text-green-500',
                  stat.variant === 'default' && 'text-muted-foreground',
                )}
              />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-2xl font-bold',
                  stat.variant === 'critical' && 'text-red-500',
                  stat.variant === 'warning' && 'text-amber-500',
                  stat.variant === 'success' && 'text-green-500',
                )}
              >
                {stat.value}
              </div>
              {stat.subValue && (
                <p className="text-xs text-muted-foreground mt-1">{stat.subValue}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

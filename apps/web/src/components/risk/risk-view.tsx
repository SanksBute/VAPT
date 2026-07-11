'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Clock, Zap, Server, Gauge } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RiskSummary {
  overallRiskScore: number;
  riskLevel: string;
  criticalVulnerabilities: number;
  slaBreached: number;
  exploitableVulnerabilities: number;
  highRiskAssets: number;
}

interface RiskProfile {
  id: string;
  name: string;
  riskScore?: number;
  riskLevel?: string;
}

const levelColor: Record<string, string> = {
  CRITICAL: 'text-red-500',
  HIGH: 'text-orange-500',
  MEDIUM: 'text-amber-500',
  LOW: 'text-green-500',
};

export function RiskView(): JSX.Element {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['risk', 'summary'],
    queryFn: () => apiGet<RiskSummary>('/risk/summary'),
  });

  const { data: profiles } = useQuery({
    queryKey: ['risk', 'profiles'],
    queryFn: () => apiGet<RiskProfile[]>('/risk/profiles'),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const s = summary;
  const score = s?.overallRiskScore ?? 0;
  const level = s?.riskLevel ?? 'LOW';

  const metrics = [
    { label: 'Critical Vulnerabilities', value: s?.criticalVulnerabilities ?? 0, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'SLA Breached', value: s?.slaBreached ?? 0, icon: Clock, color: 'text-orange-500' },
    { label: 'Exploitable', value: s?.exploitableVulnerabilities ?? 0, icon: Zap, color: 'text-amber-500' },
    { label: 'High-Risk Assets', value: s?.highRiskAssets ?? 0, icon: Server, color: 'text-blue-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Overall Risk Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className={cn('text-6xl font-bold', levelColor[level] ?? 'text-foreground')}>
              {Math.round(score)}
            </div>
            <Badge className={cn('mt-3', levelColor[level] ?? '')} variant="secondary">
              {level} RISK
            </Badge>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.label}>
                <CardContent className="pt-6 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className={cn('h-5 w-5', m.color)} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{m.value}</div>
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" /> Risk Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(profiles ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No risk profiles configured yet. Risk profiles group assets so you can track and
              prioritize risk by business area.
            </p>
          ) : (
            <div className="space-y-2">
              {(profiles ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <span className="font-medium text-sm">{p.name}</span>
                  {p.riskLevel && (
                    <Badge variant="secondary" className={cn('text-xs', levelColor[p.riskLevel] ?? '')}>
                      {p.riskLevel}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface RiskSummary {
  overallRiskScore: number;
  riskLevel: string;
  criticalVulnerabilities: number;
  slaBreached: number;
  exploitableVulnerabilities: number;
  highRiskAssets: number;
}

function getRiskColor(score: number): string {
  if (score >= 80) return '#dc2626';
  if (score >= 60) return '#ea580c';
  if (score >= 40) return '#d97706';
  return '#22c55e';
}

function getRiskLabel(level: string): string {
  return { CRITICAL: 'Critical Risk', HIGH: 'High Risk', MEDIUM: 'Medium Risk', LOW: 'Low Risk' }[level] ?? 'Unknown';
}

export function RiskScoreGauge(): JSX.Element {
  const { data, isLoading } = useQuery<RiskSummary>({
    queryKey: ['dashboard', 'risk-summary'],
    queryFn: () => apiGet<RiskSummary>('/risk/summary'),
    refetchInterval: 60000,
  });

  if (isLoading) return <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>;

  const score = data?.overallRiskScore ?? 0;
  const color = getRiskColor(score);
  const chartData = [{ value: score, fill: color }];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Score</CardTitle>
        <CardDescription>Organization security risk posture</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gauge */}
        <div className="relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height={180}>
            <RadialBarChart
              cx="50%"
              cy="85%"
              innerRadius="65%"
              outerRadius="100%"
              data={chartData}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: 'hsl(var(--muted))' }}
                dataKey="value"
                cornerRadius={8}
                label={false}
              />
            </RadialBarChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="absolute bottom-4 flex flex-col items-center">
            <span className="text-4xl font-bold" style={{ color }}>{score}</span>
            <span className="text-xs text-muted-foreground mt-1" style={{ color }}>
              {data ? getRiskLabel(data.riskLevel) : ''}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Critical Vulns', value: data?.criticalVulnerabilities ?? 0, variant: 'critical' },
            { label: 'SLA Breached', value: data?.slaBreached ?? 0, variant: 'warning' },
            { label: 'W/ Exploit', value: data?.exploitableVulnerabilities ?? 0, variant: 'high' },
            { label: 'High Risk Assets', value: data?.highRiskAssets ?? 0, variant: 'default' },
          ].map((item) => (
            <div key={item.label} className="text-center p-2 rounded-md bg-muted/50">
              <div className={cn(
                'text-lg font-bold',
                item.variant === 'critical' && 'text-red-500',
                item.variant === 'warning' && 'text-amber-500',
                item.variant === 'high' && 'text-orange-500',
              )}>
                {item.value}
              </div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

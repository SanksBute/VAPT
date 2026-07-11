'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Clock, ArrowRight, Scan,
  Shield, FileText, Plus, Star, TrendingUp, Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useUxStore } from '@/store/ux.store';
import Link from 'next/link';

interface DailyTask {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'vulnerability' | 'scan' | 'compliance' | 'asset';
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  estimatedTime: string;
  whyNow: string;
  entityId?: string;
}

interface WhatToDoData {
  criticalVulns: number;
  slaBreached: number;
  lastScanDaysAgo: number;
  totalOpenVulns: number;
  complianceGaps: number;
  unscanedAssets: number;
}

function generateTasks(data: WhatToDoData, isBeginnerMode: boolean): DailyTask[] {
  const tasks: DailyTask[] = [];

  if (data.criticalVulns > 0) {
    tasks.push({
      id: 'fix-critical',
      priority: 'critical',
      type: 'vulnerability',
      title: `Fix ${data.criticalVulns} critical vulnerability${data.criticalVulns > 1 ? 'ies' : 'y'}`,
      description: isBeginnerMode
        ? `You have ${data.criticalVulns} serious security problem${data.criticalVulns > 1 ? 's' : ''} that hackers could exploit right now. These are your #1 priority.`
        : `${data.criticalVulns} Critical severity vulnerabilities (CVSS ≥9.0) require immediate remediation.`,
      actionLabel: 'View & Fix Now',
      actionHref: '/vulnerabilities?severity=CRITICAL&status=OPEN',
      estimatedTime: '1-4 hours',
      whyNow: 'Critical vulnerabilities have a 24-hour SLA. Every hour of delay increases risk.',
    });
  }

  if (data.slaBreached > 0) {
    tasks.push({
      id: 'fix-sla',
      priority: 'high',
      type: 'vulnerability',
      title: `Address ${data.slaBreached} overdue fix${data.slaBreached > 1 ? 'es' : ''}`,
      description: isBeginnerMode
        ? `${data.slaBreached} security issue${data.slaBreached > 1 ? 's have' : ' has'} passed their repair deadline. These need attention today.`
        : `${data.slaBreached} vulnerability SLA${data.slaBreached > 1 ? 's' : ''} exceeded. Compliance risk increasing.`,
      actionLabel: 'View Overdue Items',
      actionHref: '/vulnerabilities?slaBreached=true',
      estimatedTime: '2-6 hours',
      whyNow: 'SLA breaches affect compliance scores and audit results.',
    });
  }

  if (data.lastScanDaysAgo > 7) {
    tasks.push({
      id: 'run-scan',
      priority: 'high',
      type: 'scan',
      title: 'Run a security scan',
      description: isBeginnerMode
        ? `Your last security check was ${data.lastScanDaysAgo} days ago. New vulnerabilities are discovered every day — it's time to check again.`
        : `Last scan: ${data.lastScanDaysAgo} days ago. Weekly scanning recommended for adequate coverage.`,
      actionLabel: 'Start a New Scan',
      actionHref: '/scans/new',
      estimatedTime: '15-60 minutes',
      whyNow: 'New vulnerabilities are published daily. Regular scanning catches them early.',
    });
  }

  if (data.complianceGaps > 0) {
    tasks.push({
      id: 'compliance',
      priority: 'medium',
      type: 'compliance',
      title: `Address ${data.complianceGaps} compliance gap${data.complianceGaps > 1 ? 's' : ''}`,
      description: isBeginnerMode
        ? `Your security doesn't meet some required standards. This could affect your business contracts or audits.`
        : `${data.complianceGaps} compliance controls currently non-compliant. Risk of audit findings.`,
      actionLabel: 'View Compliance',
      actionHref: '/compliance',
      estimatedTime: 'Varies',
      whyNow: 'Compliance gaps expose you to regulatory risk and can block enterprise deals.',
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      id: 'schedule-scan',
      priority: 'low',
      type: 'scan',
      title: '🎉 Looking good! Schedule your next scan',
      description: isBeginnerMode
        ? 'Great work! You have no critical issues right now. Set up a weekly automatic scan to stay on top of security.'
        : 'No critical issues detected. Configure automated scanning schedules for continuous monitoring.',
      actionLabel: 'Schedule Automatic Scan',
      actionHref: '/scans/schedule',
      estimatedTime: '5 minutes',
      whyNow: 'Regular automated scanning is the best way to stay secure.',
    });
  }

  return tasks;
}

const PRIORITY_CONFIG = {
  critical: {
    badge: 'border-red-500/50 bg-red-500/15 text-red-400',
    border: 'border-red-500/30',
    icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
    label: '🔴 Do This Now',
  },
  high: {
    badge: 'border-orange-500/50 bg-orange-500/15 text-orange-400',
    border: 'border-orange-500/30',
    icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
    label: '🟠 Do This Today',
  },
  medium: {
    badge: 'border-amber-500/50 bg-amber-500/15 text-amber-400',
    border: 'border-amber-500/30',
    icon: <Clock className="h-5 w-5 text-amber-500" />,
    label: '🟡 Do This Week',
  },
  low: {
    badge: 'border-green-500/50 bg-green-500/15 text-green-400',
    border: 'border-green-500/30',
    icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    label: '🟢 Nice to Have',
  },
};

export function WhatToDoToday(): JSX.Element {
  const { isBeginnerMode } = useUxStore();

  const { data, isLoading } = useQuery<WhatToDoData>({
    queryKey: ['dashboard', 'what-to-do'],
    queryFn: async () => {
      const [overview, riskData] = await Promise.all([
        apiGet<{ vulnerabilities: { critical: number; total: number }; recentScans: Array<{ createdAt: string }> }>('/dashboards/overview'),
        apiGet<{ slaBreached: number; criticalVulnerabilities: number }>('/risk/summary'),
      ]);

      const lastScanDate = overview.recentScans[0]?.createdAt;
      const daysSinceLastScan = lastScanDate
        ? Math.floor((Date.now() - new Date(lastScanDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        criticalVulns: overview.vulnerabilities.critical,
        slaBreached: riskData.slaBreached,
        lastScanDaysAgo: daysSinceLastScan,
        totalOpenVulns: overview.vulnerabilities.total,
        complianceGaps: 0,
        unscanedAssets: 0,
      };
    },
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  const tasks = data ? generateTasks(data, isBeginnerMode()) : [];

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {isBeginnerMode() ? 'What Should I Do Today?' : 'Recommended Actions'}
          </CardTitle>
          {isBeginnerMode() && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">
              Personalized for you
            </Badge>
          )}
        </div>
        {isBeginnerMode() && (
          <p className="text-xs text-muted-foreground mt-1">
            These are your most important security tasks right now, ordered by priority.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task, i) => {
          const config = PRIORITY_CONFIG[task.priority];
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                'p-4 rounded-xl border-2',
                config.border,
                task.priority === 'critical' ? 'bg-red-500/5' :
                task.priority === 'high' ? 'bg-orange-500/5' :
                task.priority === 'medium' ? 'bg-amber-500/5' : 'bg-green-500/5',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={cn('text-xs border', config.badge)}>{config.label}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      ⏱️ {task.estimatedTime}
                    </span>
                  </div>
                  <p className="font-semibold text-sm">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{task.description}</p>

                  {isBeginnerMode() && (
                    <p className="text-xs text-muted-foreground/70 mt-1.5 italic">
                      💡 Why now: {task.whyNow}
                    </p>
                  )}

                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1" asChild>
                    <Link href={task.actionHref}>
                      {task.actionLabel} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}

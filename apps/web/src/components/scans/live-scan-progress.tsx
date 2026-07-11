'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Clock, CheckCircle2, AlertTriangle, Loader2,
  HelpCircle, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api-client';
import { formatDuration, cn } from '@/lib/utils';
import { useWebSocket } from '@/components/providers/websocket-provider';
import { useUxStore } from '@/store/ux.store';

interface ScanStage {
  id: string;
  name: string;
  plainName: string;
  description: string;
  learnMore: string;
  icon: string;
  status: 'waiting' | 'active' | 'done' | 'error';
  progressRange: [number, number];
}

const SCAN_STAGES: ScanStage[] = [
  {
    id: 'discovery',
    name: 'Asset Discovery',
    plainName: '🔍 Finding your target',
    description: 'We\'re locating and identifying your target system — like finding the address on a map before driving there.',
    learnMore: 'Asset discovery maps out what systems and services are reachable on your target. This helps us understand what we\'re working with.',
    icon: '🗺️',
    status: 'waiting',
    progressRange: [0, 15],
  },
  {
    id: 'port_scan',
    name: 'Port Scanning',
    plainName: '🚪 Checking all the doors',
    description: 'We\'re discovering all the open "ports" — think of these as doors and windows into your system. Each port is a potential entry point.',
    learnMore: 'Ports are numbered communication channels (1–65535). Common ones: Port 80 = web traffic, Port 443 = secure web, Port 22 = remote access (SSH). Open ports that shouldn\'t be open are security risks.',
    icon: '🚪',
    status: 'waiting',
    progressRange: [15, 30],
  },
  {
    id: 'service_detect',
    name: 'Service Detection',
    plainName: '🏷️ Identifying what\'s running',
    description: 'For each open door we found, we\'re checking what software is behind it and what version it\'s running.',
    learnMore: 'Knowing the software version is crucial — hackers target known vulnerabilities in specific versions. If you\'re running an outdated version, we need to know.',
    icon: '🔬',
    status: 'waiting',
    progressRange: [30, 45],
  },
  {
    id: 'vuln_check',
    name: 'Vulnerability Assessment',
    plainName: '🛡️ Checking for known weaknesses',
    description: 'We\'re comparing everything we found against our database of 100,000+ known security vulnerabilities. This is like checking if your locks appear on a list of known defective products.',
    learnMore: 'A vulnerability (or CVE) is a publicly documented security flaw. When researchers find bugs, they get an ID like CVE-2024-1234. We check if your software has any of these known issues.',
    icon: '🗄️',
    status: 'waiting',
    progressRange: [45, 70],
  },
  {
    id: 'web_crawl',
    name: 'Web Crawling',
    plainName: '🕷️ Exploring your website pages',
    description: 'For web targets, we\'re visiting every page of your website — like a very fast, thorough human reading your entire site.',
    learnMore: 'Web crawling maps out all the pages, forms, links, and features of your web application. We need to find all the places where users can enter data, as these are common attack points.',
    icon: '🕸️',
    status: 'waiting',
    progressRange: [50, 65],
  },
  {
    id: 'attack_simulation',
    name: 'Attack Simulation',
    plainName: '🎯 Testing attack scenarios',
    description: 'We\'re safely attempting known attack techniques — like a locksmith testing if your locks can be picked. We don\'t actually damage anything.',
    learnMore: 'This is where we test for SQL Injection (tricking databases), XSS (injecting malicious scripts), SSRF (making your server fetch internal resources), and other OWASP Top 10 vulnerabilities.',
    icon: '⚔️',
    status: 'waiting',
    progressRange: [65, 85],
  },
  {
    id: 'risk_analysis',
    name: 'Risk Analysis',
    plainName: '📊 Calculating risk scores',
    description: 'We\'re scoring each issue we found based on how serious it is, how easy it is to exploit, and what damage it could cause.',
    learnMore: 'We use CVSS (Common Vulnerability Scoring System) — a standardized 0-10 scale. 9-10 = Critical, 7-8.9 = High, 4-6.9 = Medium, 1-3.9 = Low. We also check EPSS scores — the probability that a vulnerability will be exploited in the next 30 days.',
    icon: '📈',
    status: 'waiting',
    progressRange: [85, 95],
  },
  {
    id: 'report',
    name: 'Report Generation',
    plainName: '📝 Creating your report',
    description: 'We\'re compiling all findings into a clear, actionable report with step-by-step fix instructions.',
    learnMore: 'Your report includes an executive summary (business language), technical details (for your IT team), and specific fix instructions for each vulnerability found.',
    icon: '📋',
    status: 'waiting',
    progressRange: [95, 100],
  },
];

interface LiveScanProgressProps {
  scanId: string;
}

export function LiveScanProgress({ scanId }: LiveScanProgressProps): JSX.Element {
  const [stages, setStages] = useState<ScanStage[]>(SCAN_STAGES);
  const [expandedLearnMore, setExpandedLearnMore] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recentEvents, setRecentEvents] = useState<Array<{ message: string; time: string; type: string }>>([]);
  const { subscribe } = useWebSocket();
  const { isBeginnerMode } = useUxStore();

  const { data: scanData, refetch } = useQuery({
    queryKey: ['scan', scanId, 'live'],
    queryFn: () => apiGet<{
      status: string;
      progress: number;
      findings: number;
      criticalCount: number;
      highCount: number;
      startedAt: string | null;
    }>(`/scans/${scanId}`),
    refetchInterval: 5000,
  });

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for live events
  useEffect(() => {
    const unsubProgress = subscribe(`scan:${scanId}:progress`, (data) => {
      void refetch();
    });

    const unsubEvent = subscribe(`scan:${scanId}:event`, (data: unknown) => {
      const event = data as { message: string; type: string };
      setRecentEvents((prev) => [
        { message: event.message, time: new Date().toLocaleTimeString(), type: event.type },
        ...prev.slice(0, 9),
      ]);
    });

    return () => {
      unsubProgress();
      unsubEvent();
    };
  }, [scanId, subscribe, refetch]);

  // Update stage statuses based on progress
  useEffect(() => {
    if (!scanData) return;
    const progress = scanData.progress;

    setStages((prev) =>
      prev.map((stage) => {
        const [min, max] = stage.progressRange;
        if (progress >= max) return { ...stage, status: 'done' };
        if (progress >= min) return { ...stage, status: 'active' };
        return { ...stage, status: 'waiting' };
      }),
    );
  }, [scanData?.progress]);

  const isComplete = scanData?.status === 'COMPLETED' || scanData?.status === 'FAILED';
  const currentStage = stages.find((s) => s.status === 'active');
  const progress = scanData?.progress ?? 0;

  return (
    <div className="space-y-4">
      {/* Main progress card */}
      <Card className={cn(
        'border-2',
        isComplete && scanData?.status === 'COMPLETED' ? 'border-green-500/30' :
        isComplete ? 'border-red-500/30' : 'border-primary/30',
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isComplete ? (
                scanData?.status === 'COMPLETED' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )
              ) : (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              )}
              {isComplete
                ? scanData?.status === 'COMPLETED' ? 'Scan Complete!' : 'Scan Failed'
                : currentStage?.plainName ?? 'Initializing...'}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDuration(elapsedSeconds)}
            </div>
          </div>

          {/* Description in beginner mode */}
          {isBeginnerMode() && currentStage && !isComplete && (
            <motion.p
              key={currentStage.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-muted-foreground mt-2"
            >
              {currentStage.description}
            </motion.p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Live findings counter */}
          {(scanData?.findings ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
            >
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium">
                  {scanData.findings} issue{scanData.findings !== 1 ? 's' : ''} found so far
                </p>
                {scanData.criticalCount > 0 && (
                  <p className="text-xs text-red-400">
                    Including {scanData.criticalCount} critical issue{scanData.criticalCount !== 1 ? 's' : ''} requiring immediate attention
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Stage breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isBeginnerMode() ? '🗺️ What\'s happening right now' : 'Scan Stages'}
          </CardTitle>
          {isBeginnerMode() && (
            <p className="text-xs text-muted-foreground">
              Each step below is a different phase of the security test. Click any step to learn more about what it does.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {stages.map((stage) => (
            <div key={stage.id}>
              <button
                onClick={() => setExpandedLearnMore(expandedLearnMore === stage.id ? null : stage.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left',
                  stage.status === 'active' ? 'bg-primary/10 border border-primary/30' :
                  stage.status === 'done' ? 'bg-muted/30' : 'opacity-40',
                )}
              >
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs',
                  stage.status === 'active' ? 'bg-primary text-primary-foreground' :
                  stage.status === 'done' ? 'bg-green-500 text-white' : 'bg-muted',
                )}>
                  {stage.status === 'active' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : stage.status === 'done' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    stage.progressRange[0] / 10 + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    stage.status === 'active' ? 'text-primary' :
                    stage.status === 'done' ? 'text-muted-foreground line-through' : '',
                  )}>
                    {isBeginnerMode() ? stage.plainName : stage.name}
                  </p>
                </div>
                {stage.status === 'active' && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs animate-pulse">
                    Running
                  </Badge>
                )}
                {isBeginnerMode() && (
                  <HelpCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {/* Learn more expansion */}
              <AnimatePresence>
                {expandedLearnMore === stage.id && isBeginnerMode() && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-9 mr-2 mb-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-muted-foreground">
                      <p className="font-medium text-blue-400 mb-1">💡 Learn: What is {stage.name}?</p>
                      <p>{stage.learnMore}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent events log */}
      {recentEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              {isBeginnerMode() ? 'Live Activity Feed' : 'Event Log'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentEvents.map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground flex-shrink-0">{event.time}</span>
                  <span className={cn(
                    event.type === 'error' ? 'text-red-400' :
                    event.type === 'warning' ? 'text-amber-400' : 'text-muted-foreground',
                  )}>
                    {event.message}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

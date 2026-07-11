'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { formatRelativeTime, getStatusBadgeClass, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { HintBanner } from '@/components/ui/guide-tooltip';
import { NewScanButton } from '@/components/scans/new-scan-button';

interface ScanItem {
  id: string;
  name: string;
  status: string;
  scanType: string;
  findings: number;
  criticalCount: number;
  highCount: number;
  createdAt: string;
}

export interface ScanCategoryViewProps {
  title: string;
  description: string;
  helpContext: string;
  /** ScanType enum values that belong to this category */
  scanTypes: string[];
  hintTitle: string;
  hintDescription: string;
}

export function ScanCategoryView({
  title,
  description,
  helpContext,
  scanTypes,
  hintTitle,
  hintDescription,
}: ScanCategoryViewProps): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['scans', 'category', scanTypes],
    queryFn: () =>
      apiGet<{ items: ScanItem[] }>('/scans', { scanType: scanTypes, limit: 50 }),
    refetchInterval: 15000,
  });

  const items = data?.items ?? [];
  const totalFindings = items.reduce((sum, s) => sum + (s.findings ?? 0), 0);
  const totalCritical = items.reduce((sum, s) => sum + (s.criticalCount ?? 0), 0);
  const running = items.filter((s) => s.status === 'RUNNING' || s.status === 'INITIALIZING').length;

  const stats = [
    { label: 'Total Scans', value: items.length },
    { label: 'Running', value: running },
    { label: 'Findings', value: totalFindings },
    { label: 'Critical', value: totalCritical },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        helpContext={helpContext}
        actions={<NewScanButton />}
      />

      <HintBanner
        id={`${helpContext}-intro`}
        title={hintTitle}
        description={hintDescription}
        variant="info"
        learnMoreConcept="vulnerability-assessment"
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium">No {title.toLowerCase()} scans yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Click <span className="font-medium">New Scan</span> above to start your first{' '}
                {title.toLowerCase()} scan. Results will appear here as they complete.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/scans/${scan.id}`}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 border border-border"
                >
                  <div>
                    <p className="font-medium text-sm">{scan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {scan.scanType} · {formatRelativeTime(scan.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {scan.criticalCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {scan.criticalCount} critical
                      </Badge>
                    )}
                    <Badge className={cn('text-xs border', getStatusBadgeClass(scan.status))}>
                      {scan.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

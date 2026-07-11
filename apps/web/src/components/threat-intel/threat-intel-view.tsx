'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Radio, Globe, FileWarning } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/lib/utils';

interface Feed {
  id: string;
  name: string;
  provider?: string;
  type?: string;
  indicatorCount?: number;
  lastSyncedAt?: string | null;
  isActive?: boolean;
}

interface Indicator {
  id: string;
  type: string;
  value: string;
  severity?: string;
  confidence?: number;
  firstSeenAt?: string;
}

export function ThreatIntelView(): JSX.Element {
  const [search, setSearch] = useState('');

  const { data: feeds, isLoading: loadingFeeds } = useQuery({
    queryKey: ['threat-intel', 'feeds'],
    queryFn: () => apiGet<Feed[]>('/threat-intel/feeds'),
  });

  const { data: indicators, isLoading: loadingIndicators } = useQuery({
    queryKey: ['threat-intel', 'indicators'],
    queryFn: () => apiGet<{ items?: Indicator[] } | Indicator[]>('/threat-intel/indicators'),
  });

  const indicatorList: Indicator[] = Array.isArray(indicators)
    ? indicators
    : indicators?.items ?? [];

  const filtered = search
    ? indicatorList.filter((i) => i.value.toLowerCase().includes(search.toLowerCase()))
    : indicatorList;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" /> Threat Feeds
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFeeds ? (
            <Skeleton className="h-24 w-full" />
          ) : (feeds ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No threat feeds connected yet. Connect a feed to start ingesting indicators of
              compromise from providers like AlienVault OTX, Abuse.ch, and others.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(feeds ?? []).map((feed) => (
                <div key={feed.id} className="p-3 rounded-md border border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      {feed.name}
                    </span>
                    <Badge variant={feed.isActive ? 'default' : 'secondary'} className="text-xs">
                      {feed.isActive ? 'Active' : 'Idle'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {feed.indicatorCount ?? 0} indicators
                    {feed.lastSyncedAt ? ` · synced ${formatRelativeTime(feed.lastSyncedAt)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-primary" /> Indicators of Compromise
            </CardTitle>
            <div className="relative w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search indicators…"
                className="pl-9 h-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingIndicators ? (
            <Skeleton className="h-32 w-full" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {search ? 'No indicators match your search.' : 'No indicators ingested yet.'}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.slice(0, 100).map((ind) => (
                <div
                  key={ind.id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {ind.type}
                    </Badge>
                    <span className="font-mono text-xs truncate">{ind.value}</span>
                  </div>
                  {ind.severity && (
                    <Badge variant="secondary" className="text-xs">
                      {ind.severity}
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

'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, Puzzle, Check, Download, Loader2 } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface Plugin {
  id: string;
  name: string;
  description?: string;
  category?: string;
  publisher?: string;
  version?: string;
  iconUrl?: string;
  installed?: boolean;
}

export function MarketplaceView(): JSX.Element {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'plugins'],
    queryFn: () => apiGet<{ items: Plugin[] }>('/marketplace/plugins', { limit: 48 }),
  });

  const { data: installed } = useQuery({
    queryKey: ['marketplace', 'installed'],
    queryFn: () => apiGet<Plugin[]>('/marketplace/installed'),
  });

  const installedIds = new Set((installed ?? []).map((p) => p.id));

  const install = useMutation({
    mutationFn: (id: string) => apiPost(`/marketplace/plugins/${id}/install`),
    onSuccess: () => {
      toast.success('Plugin installed.');
      void queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
    onError: () => toast.error('Could not install the plugin.'),
  });

  const uninstall = useMutation({
    mutationFn: (id: string) => apiDelete(`/marketplace/plugins/${id}/uninstall`),
    onSuccess: () => {
      toast.success('Plugin removed.');
      void queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
    onError: () => toast.error('Could not remove the plugin.'),
  });

  const plugins = (data?.items ?? []).filter((p) =>
    search ? p.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search plugins…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-28 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center">
            <Puzzle className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No plugins available yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              The marketplace catalog is empty in this environment. Published plugins and
              integrations will appear here for one-click install.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => {
            const isInstalled = plugin.installed || installedIds.has(plugin.id);
            return (
              <Card key={plugin.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Puzzle className="h-4 w-4 text-primary" />
                      {plugin.name}
                    </CardTitle>
                    {plugin.category && (
                      <Badge variant="secondary" className="text-xs">{plugin.category}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-xs text-muted-foreground flex-1">
                    {plugin.description ?? 'No description provided.'}
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-muted-foreground">
                      {plugin.publisher ?? 'SentinelX'} {plugin.version ? `· v${plugin.version}` : ''}
                    </span>
                    {isInstalled ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => uninstall.mutate(plugin.id)}
                        disabled={uninstall.isPending}
                      >
                        <Check className="h-3 w-3 mr-1" /> Installed
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => install.mutate(plugin.id)}
                        disabled={install.isPending}
                      >
                        {install.isPending && install.variables === plugin.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3 mr-1" />
                        )}
                        Install
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

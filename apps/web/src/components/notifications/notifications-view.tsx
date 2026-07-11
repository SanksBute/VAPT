'use client';

import React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatRelativeTime } from '@/lib/utils';

interface Notification {
  id: string;
  severity: string;
  title: string;
  message: string;
  eventType: string;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}

const severityIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  CRITICAL: ShieldAlert,
  HIGH: AlertTriangle,
  WARNING: AlertTriangle,
  INFO: Info,
};
const severityColor: Record<string, string> = {
  CRITICAL: 'text-red-500',
  HIGH: 'text-orange-500',
  WARNING: 'text-amber-500',
  INFO: 'text-blue-500',
};

export function NotificationsView(): JSX.Element {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => apiGet<{ items: Notification[]; unreadCount: number }>('/notifications', { limit: 100 }),
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiPost('/notifications/mark-all-read'),
    onSuccess: () => {
      toast.success('All notifications marked as read.');
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiPost('/notifications/mark-read', { ids: [id] }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.unreadCount ?? 0} unread notification{(data?.unreadCount ?? 0) === 1 ? '' : 's'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || (data?.unreadCount ?? 0) === 0}
          className="gap-2"
        >
          <CheckCheck className="h-4 w-4" /> Mark all as read
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center">
            <Bell className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground mt-1">
              New alerts about scans, findings, and SLAs will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = severityIcon[n.severity] ?? Info;
            const unread = !n.readAt;
            const body = (
              <div
                className={cn(
                  'flex items-start gap-3 p-4 rounded-md border border-border',
                  unread ? 'bg-primary/5' : 'bg-transparent',
                )}
              >
                <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', severityColor[n.severity] ?? 'text-muted-foreground')} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{n.title}</p>
                    {unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.createdAt)}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {n.severity}
                </Badge>
              </div>
            );

            return (
              <div key={n.id} onClick={() => unread && markRead.mutate(n.id)}>
                {n.actionUrl ? <Link href={n.actionUrl as Route}>{body}</Link> : body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

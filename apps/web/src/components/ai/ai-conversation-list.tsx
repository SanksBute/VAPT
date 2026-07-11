'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Trash2, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiDelete } from '@/lib/api-client';
import { formatRelativeTime, cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string | null;
  context: string | null;
  provider: string;
  model: string;
  tokenCount: number;
  updatedAt: string;
  _count: { messages: number };
}

export function AiConversationList(): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ['ai', 'conversations'],
    queryFn: () => apiGet<Conversation[]>('/ai/conversations'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/ai/conversations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
      if (selected) setSelected(null);
    },
  });

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Conversations</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSelected(null)}
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-2 space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))
            : data.length === 0
              ? (
                  <div className="text-center py-8">
                    <Brain className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No conversations yet</p>
                  </div>
                )
              : data.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded-md cursor-pointer group hover:bg-muted/50 transition-colors',
                      selected === conv.id && 'bg-primary/10',
                    )}
                    onClick={() => setSelected(conv.id)}
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {conv.title ?? 'New Conversation'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(conv.updatedAt)} · {conv._count.messages} msgs
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(conv.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

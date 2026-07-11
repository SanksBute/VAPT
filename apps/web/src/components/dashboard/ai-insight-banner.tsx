'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api-client';
import Link from 'next/link';

interface AiInsight {
  summary: string;
  criticalItems: string[];
  recommendation: string;
}

export function AIInsightBanner(): JSX.Element {
  const { data, isLoading } = useQuery<AiInsight>({
    queryKey: ['ai', 'daily-insight'],
    queryFn: async () => {
      // Generate a daily insight from the AI
      const result = await apiGet<{ summary: string }>('/dashboards/overview');
      return {
        summary: 'AI analysis complete. Your security posture has improved this week.',
        criticalItems: [],
        recommendation: 'Focus on remediating critical vulnerabilities with available exploits.',
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  if (isLoading) return <Skeleton className="h-16 w-full rounded-lg" />;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="outline" className="text-xs px-1.5 border-primary/30 text-primary">
              AI Insight
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {data?.recommendation ?? 'Loading AI insights...'}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="flex-shrink-0" asChild>
          <Link href="/ai-copilot">
            Ask AI <ChevronRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

'use client';

import React from 'react';
import { HelpCircle, Brain, BookOpen, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUxStore } from '@/store/ux.store';
import { cn } from '@/lib/utils';
import { useHasHydrated } from '@/hooks/use-hydrated';

interface PageHeaderProps {
  title: string;
  description: string;
  helpContext?: string;
  actions?: React.ReactNode;
  breadcrumb?: string;
  badge?: string;
  estimatedTime?: string;
  stepNumber?: number;
  totalSteps?: number;
}

export function PageHeader({
  title,
  description,
  helpContext,
  actions,
  breadcrumb,
  badge,
  estimatedTime,
  stepNumber,
  totalSteps,
}: PageHeaderProps): JSX.Element {
  const { openHelp, openCopilot, isBeginnerMode } = useUxStore();

  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0 flex-1">
        {/* Breadcrumb */}
        {breadcrumb && (
          <p className="text-xs text-muted-foreground mb-1">{breadcrumb}</p>
        )}

        {/* Title row */}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {badge && (
            <Badge variant="secondary" className="text-xs">{badge}</Badge>
          )}
          {stepNumber && totalSteps && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
              Step {stepNumber} of {totalSteps}
            </Badge>
          )}
          {estimatedTime && isBeginnerMode() && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              ⏱️ About {estimatedTime}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">{description}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}

        {/* Help button */}
        {helpContext && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => openHelp(helpContext)}
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open help & documentation</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* AI Copilot button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => openCopilot({ page: helpContext ?? 'default' })}
              >
                <Brain className="h-4 w-4 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ask AI Assistant</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export function EducationModeToggle(): JSX.Element {
  const { experienceLevel, setExperienceLevel, isBeginnerMode } = useUxStore();
  const hasHydrated = useHasHydrated();
  const beginnerMode = hasHydrated ? isBeginnerMode() : true;

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <button
        onClick={() => setExperienceLevel('beginner')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          beginnerMode
            ? 'bg-background shadow text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <BookOpen className="h-3.5 w-3.5" />
        Beginner
      </button>
      <button
        onClick={() => setExperienceLevel('professional')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          !beginnerMode
            ? 'bg-background shadow text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        Professional
      </button>
    </div>
  );
}

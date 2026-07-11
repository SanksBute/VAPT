'use client';

import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { HelpCircle, ExternalLink, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUxStore } from '@/store/ux.store';
import { useHasHydrated } from '@/hooks/use-hydrated';

interface GuideTooltipProps {
  content: string;
  example?: string;
  learnMoreConcept?: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function GuideTooltip({
  content,
  example,
  learnMoreConcept,
  children,
  side = 'top',
}: GuideTooltipProps): JSX.Element {
  const { openLearning } = useUxStore();

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-xl bg-popover border border-border text-popover-foreground shadow-xl p-3"
          >
            <p className="text-xs leading-relaxed">{content}</p>
            {example && (
              <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Example:</p>
                <p className="text-xs font-mono text-muted-foreground">{example}</p>
              </div>
            )}
            {learnMoreConcept && (
              <button
                onClick={() => openLearning(learnMoreConcept)}
                className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <BookOpen className="h-3 w-3" /> Learn more
              </button>
            )}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

interface FieldLabelWithHelpProps {
  label: string;
  required?: boolean;
  tooltip?: string;
  example?: string;
  learnMoreConcept?: string;
  className?: string;
}

export function FieldLabelWithHelp({
  label,
  required,
  tooltip,
  example,
  learnMoreConcept,
  className,
}: FieldLabelWithHelpProps): JSX.Element {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      {tooltip && (
        <GuideTooltip content={tooltip} example={example} learnMoreConcept={learnMoreConcept}>
          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </GuideTooltip>
      )}
    </div>
  );
}

interface HintBannerProps {
  id: string;
  title: string;
  description: string;
  variant?: 'info' | 'tip' | 'warning';
  learnMoreConcept?: string;
}

export function HintBanner({
  id,
  title,
  description,
  variant = 'info',
  learnMoreConcept,
}: HintBannerProps): JSX.Element | null {
  const { isHintDismissed, dismissHint, openLearning, isBeginnerMode } = useUxStore();
  const hasHydrated = useHasHydrated();

  // Before hydration, persisted preferences aren't safe to read yet — render
  // the same default (visible) state the server rendered.
  if (hasHydrated && (!isBeginnerMode() || isHintDismissed(id))) return null;

  const config = {
    info: { bg: 'bg-blue-500/10 border-blue-500/20', icon: '💡', titleColor: 'text-blue-400' },
    tip: { bg: 'bg-primary/10 border-primary/20', icon: '🎯', titleColor: 'text-primary' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/20', icon: '⚠️', titleColor: 'text-amber-400' },
  }[variant];

  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-xl border', config.bg)}>
      <span className="text-lg flex-shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', config.titleColor)}>{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        {learnMoreConcept && (
          <button
            onClick={() => openLearning(learnMoreConcept)}
            className="text-xs text-primary hover:underline mt-1.5 flex items-center gap-1"
          >
            <BookOpen className="h-3 w-3" /> Learn more about this
          </button>
        )}
      </div>
      <button
        onClick={() => dismissHint(id)}
        className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0 px-2 py-1 hover:bg-muted rounded-md transition-colors"
      >
        Got it
      </button>
    </div>
  );
}

interface StepIndicatorProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description?: string;
  estimatedTime?: string;
  requiredPermission?: string;
}

export function StepIndicator({
  stepNumber,
  totalSteps,
  title,
  description,
  estimatedTime,
  requiredPermission,
}: StepIndicatorProps): JSX.Element {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
          {stepNumber}
        </div>
        <div className="text-xs text-muted-foreground">of {totalSteps}</div>
      </div>
      <div>
        <h3 className="font-bold text-lg">{title}</h3>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
        <div className="flex flex-wrap items-center gap-3 mt-1">
          {estimatedTime && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              ⏱️ Estimated time: {estimatedTime}
            </span>
          )}
          {requiredPermission && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              🔑 Requires: {requiredPermission}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

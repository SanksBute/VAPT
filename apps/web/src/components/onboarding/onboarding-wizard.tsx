'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Shield, Globe, Server, Code, Cloud, Network, Database,
  Smartphone, Lock, ChevronRight, ChevronLeft, CheckCircle2,
  Sparkles, ArrowRight, Clock, Star, AlertTriangle, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUxStore } from '@/store/ux.store';
import { useAuthStore } from '@/store/auth.store';

interface Goal {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  scanType: string;
  estimatedTime: string;
  riskLevel: 'low' | 'medium' | 'high';
  requirements: string[];
  preparation: string[];
  recommended: boolean;
}

const GOALS: Goal[] = [
  {
    id: 'website',
    label: 'My Website',
    description: 'Check if your public website has security weaknesses that hackers could exploit',
    icon: Globe,
    scanType: 'WEB_APPLICATION',
    estimatedTime: '15–30 minutes',
    riskLevel: 'medium',
    requirements: ['Website URL (e.g. https://yoursite.com)', 'Confirmation you own the site'],
    preparation: ['Make sure you have admin access', 'No special tools needed'],
    recommended: true,
  },
  {
    id: 'webapp',
    label: 'Web Application',
    description: 'Test a login-protected app like a customer portal, admin dashboard, or SaaS product',
    icon: Lock,
    scanType: 'WEB_APPLICATION',
    estimatedTime: '30–60 minutes',
    riskLevel: 'high',
    requirements: ['App URL', 'Test login credentials', 'List of pages to test'],
    preparation: ['Create a test account', 'Back up your data first', 'Run during low-traffic hours'],
    recommended: false,
  },
  {
    id: 'api',
    label: 'API / Backend Service',
    description: 'Test the programming interfaces that power your mobile app or integrations',
    icon: Server,
    scanType: 'API_SECURITY',
    estimatedTime: '20–45 minutes',
    riskLevel: 'high',
    requirements: ['API base URL', 'API documentation or endpoints list', 'Authentication token (optional)'],
    preparation: ['Have your API docs ready', 'Use a staging environment if possible'],
    recommended: false,
  },
  {
    id: 'cloud',
    label: 'Cloud Infrastructure',
    description: 'Check your AWS, Azure, or Google Cloud setup for security misconfigurations',
    icon: Cloud,
    scanType: 'CLOUD_SECURITY',
    estimatedTime: '10–20 minutes',
    riskLevel: 'medium',
    requirements: ['Read-only cloud credentials', 'Cloud provider (AWS / Azure / GCP)'],
    preparation: ['Create a read-only IAM role', 'No changes will be made to your cloud'],
    recommended: false,
  },
  {
    id: 'server',
    label: 'Server / Computer',
    description: 'Scan an IP address or server for open doors that attackers could walk through',
    icon: Server,
    scanType: 'DISCOVERY',
    estimatedTime: '10–20 minutes',
    riskLevel: 'medium',
    requirements: ['IP address or hostname', 'Network access to the target'],
    preparation: ['Confirm you own or have permission to test this server'],
    recommended: false,
  },
  {
    id: 'network',
    label: 'Network / Internal Systems',
    description: 'Scan your office network or internal systems for vulnerabilities',
    icon: Network,
    scanType: 'DISCOVERY',
    estimatedTime: '20–40 minutes',
    riskLevel: 'medium',
    requirements: ['Network range (e.g. 192.168.1.0/24)', 'Internal network access'],
    preparation: ['Run from inside your network', 'Notify your IT team first'],
    recommended: false,
  },
  {
    id: 'code',
    label: 'Source Code',
    description: 'Review your software code for security bugs before deploying',
    icon: Code,
    scanType: 'CODE_ANALYSIS',
    estimatedTime: '5–30 minutes (depends on code size)',
    riskLevel: 'low',
    requirements: ['Code repository URL or files', 'Supported languages: Python, JS, Java, Go, etc.'],
    preparation: ['Safe to run — your code is never modified'],
    recommended: false,
  },
  {
    id: 'container',
    label: 'Docker / Container',
    description: 'Check Docker images and containers for known vulnerabilities in software packages',
    icon: Database,
    scanType: 'CONTAINER_SECURITY',
    estimatedTime: '5–15 minutes',
    riskLevel: 'low',
    requirements: ['Docker image name (e.g. nginx:latest)'],
    preparation: ['No special access needed'],
    recommended: false,
  },
];

const TEAM_SIZES = [
  { id: 'solo', label: 'Just me', description: 'I\'m the only one managing security' },
  { id: 'small', label: '2–10 people', description: 'Small team' },
  { id: 'medium', label: '11–50 people', description: 'Growing company' },
  { id: 'large', label: '50+ people', description: 'Enterprise organization' },
];

const MATURITY_LEVELS = [
  {
    id: 'new',
    label: '🌱 Just getting started',
    description: 'I\'ve never done security testing before',
    detail: 'We\'ll walk you through every step with simple explanations',
  },
  {
    id: 'learning',
    label: '📚 Learning the basics',
    description: 'I know a little bit about security',
    detail: 'We\'ll explain concepts while keeping things practical',
  },
  {
    id: 'experienced',
    label: '⚡ Experienced professional',
    description: 'I\'ve done security testing before',
    detail: 'Advanced mode with full control over all settings',
  },
];

const STEPS = [
  { id: 0, title: 'Welcome', icon: '👋' },
  { id: 1, title: 'What to Secure', icon: '🎯' },
  { id: 2, title: 'Your Team', icon: '👥' },
  { id: 3, title: 'Experience Level', icon: '🎓' },
  { id: 4, title: 'Recommendations', icon: '✨' },
];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }): JSX.Element {
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState<string>('');
  const [maturity, setMaturity] = useState<string>('new');
  const { updateOnboarding, setOnboardingCompleted, setExperienceLevel } = useUxStore();
  const { user } = useAuthStore();
  const router = useRouter();

  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const toggleGoal = (id: string): void => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const primaryGoal = GOALS.find((g) => g.id === selectedGoals[0]);

  const handleComplete = useCallback((): void => {
    const level = maturity === 'experienced' ? 'professional' : 'beginner';
    setExperienceLevel(level);
    updateOnboarding({
      completed: true,
      selectedGoals,
      teamSize,
      securityMaturity: maturity as 'new' | 'learning' | 'experienced',
      recommendedScanType: primaryGoal?.scanType ?? 'DISCOVERY',
    });
    setOnboardingCompleted(true);
    onComplete();
  }, [maturity, selectedGoals, teamSize, primaryGoal, setExperienceLevel, updateOnboarding, setOnboardingCompleted, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-3xl">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  'flex items-center gap-2 text-sm',
                  i === step ? 'text-primary font-medium' : i < step ? 'text-muted-foreground' : 'text-muted-foreground/40',
                )}
              >
                <span className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                  i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-primary/20 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground',
                )}>
                  {i < step ? '✓' : s.icon}
                </span>
                <span className="hidden sm:block">{s.title}</span>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-3 w-3 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="p-8 text-center">
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <Shield className="h-10 w-10 text-primary" />
                    </div>
                    <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>

                <h1 className="text-3xl font-bold mb-3">
                  Welcome to SentinelX AI{user?.firstName ? `, ${user.firstName}` : ''}! 👋
                </h1>
                <p className="text-muted-foreground text-lg mb-2 max-w-lg mx-auto">
                  Your personal security assistant. We make cybersecurity simple — no technical knowledge required.
                </p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
                  Think of us as a security expert working alongside you, explaining everything in plain language and guiding you step by step.
                </p>

                <div className="grid grid-cols-3 gap-4 mb-8 text-left">
                  {[
                    { icon: '🔍', title: 'Find Vulnerabilities', desc: 'Discover security weaknesses before hackers do' },
                    { icon: '🧠', title: 'AI Explains Everything', desc: 'Every finding explained in simple language' },
                    { icon: '🛠️', title: 'Step-by-Step Fixes', desc: 'Clear instructions to fix every issue found' },
                  ].map((item) => (
                    <div key={item.title} className="p-4 rounded-xl bg-muted/50 border border-border">
                      <div className="text-2xl mb-2">{item.icon}</div>
                      <div className="font-semibold text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-left">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⏱️</span>
                    <div>
                      <p className="font-medium text-sm">Setup takes about 2 minutes</p>
                      <p className="text-xs text-muted-foreground">We'll ask a few questions to personalize your experience. You can change everything later.</p>
                    </div>
                  </div>
                </div>

                <Button onClick={() => setStep(1)} size="lg" className="gap-2 px-8">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Step 1: What to Secure */}
            {step === 1 && (
              <div className="p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">What do you want to protect? 🎯</h2>
                  <p className="text-muted-foreground">
                    Select everything that applies to you. We'll recommend the right security tests for each one.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Not sure? Select "My Website" — it's the most common starting point.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {GOALS.map((goal) => {
                    const Icon = goal.icon;
                    const selected = selectedGoals.includes(goal.id);
                    return (
                      <button
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={cn(
                          'relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                          selected
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50',
                        )}
                      >
                        {goal.recommended && (
                          <div className="absolute -top-2 -right-2">
                            <Badge className="text-[10px] px-1.5 py-0 bg-green-500 text-white border-0">
                              ⭐ Popular
                            </Badge>
                          </div>
                        )}
                        <div className={cn(
                          'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                          selected ? 'bg-primary text-primary-foreground' : 'bg-muted',
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm">{goal.label}</p>
                            {selected && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{goal.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {goal.estimatedTime}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Team Size */}
            {step === 2 && (
              <div className="p-8">
                <h2 className="text-2xl font-bold mb-2">Tell us about your team 👥</h2>
                <p className="text-muted-foreground mb-6">
                  This helps us tailor the experience and recommendations to your situation.
                </p>
                <div className="space-y-3">
                  {TEAM_SIZES.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setTeamSize(size.id)}
                      className={cn(
                        'w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all',
                        teamSize === size.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50',
                      )}
                    >
                      <div>
                        <p className="font-semibold">{size.label}</p>
                        <p className="text-sm text-muted-foreground">{size.description}</p>
                      </div>
                      {teamSize === size.id && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Experience Level */}
            {step === 3 && (
              <div className="p-8">
                <h2 className="text-2xl font-bold mb-2">How familiar are you with security? 🎓</h2>
                <p className="text-muted-foreground mb-2">
                  Be honest — there's no wrong answer. We'll adjust everything to match your knowledge level.
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  💡 You can always change this later using the "Beginner/Professional" toggle in the top bar.
                </p>
                <div className="space-y-3">
                  {MATURITY_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setMaturity(level.id)}
                      className={cn(
                        'w-full flex items-start justify-between p-5 rounded-xl border-2 text-left transition-all',
                        maturity === level.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50',
                      )}
                    >
                      <div>
                        <p className="font-semibold text-lg">{level.label}</p>
                        <p className="text-muted-foreground text-sm mt-0.5">{level.description}</p>
                        <p className="text-xs text-primary mt-2 font-medium">{level.detail}</p>
                      </div>
                      {maturity === level.id && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-1" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Recommendations */}
            {step === 4 && (
              <div className="p-8">
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">✨</div>
                  <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
                  <p className="text-muted-foreground">
                    Here's your personalized security plan based on what you told us.
                  </p>
                </div>

                {selectedGoals.length > 0 && primaryGoal && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-4 w-4 text-primary" />
                      <p className="font-semibold text-sm">Your first recommended action</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        {React.createElement(primaryGoal.icon, { className: 'h-5 w-5 text-primary' })}
                      </div>
                      <div>
                        <p className="font-semibold">{primaryGoal.label} Security Scan</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{primaryGoal.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {primaryGoal.estimatedTime}
                          </span>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            primaryGoal.riskLevel === 'high' ? 'bg-red-500/15 text-red-500' :
                            primaryGoal.riskLevel === 'medium' ? 'bg-amber-500/15 text-amber-500' :
                            'bg-green-500/15 text-green-500',
                          )}>
                            {primaryGoal.riskLevel === 'high' ? '⚠️ Use staging environment' :
                             primaryGoal.riskLevel === 'medium' ? '📋 Authorization required' :
                             '✅ Safe to run'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 mb-6">
                  {[
                    { icon: maturity === 'new' ? '📖' : '⚙️', title: maturity === 'new' ? 'Beginner Mode Enabled' : 'Professional Mode Enabled', desc: maturity === 'new' ? 'All technical terms explained in plain language' : 'Full control over advanced settings and configurations' },
                    { icon: '🤖', title: 'AI Assistant Ready', desc: 'Your AI security copilot is available on every page — just ask anything' },
                    { icon: '📊', title: 'Dashboard Personalized', desc: 'Your security tasks have been prioritized based on your goals' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={handleComplete} size="lg" className="w-full gap-2">
                  <Sparkles className="h-4 w-4" />
                  Go to My Dashboard
                </Button>
              </div>
            )}

            {/* Navigation */}
            {step > 0 && (
              <div className="flex items-center justify-between px-8 pb-6">
                <Button variant="ghost" onClick={() => setStep(step - 1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Back
                </Button>
                {step < 4 && (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={
                      (step === 1 && selectedGoals.length === 0) ||
                      (step === 2 && !teamSize)
                    }
                    className="gap-1"
                  >
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Skip */}
        {step > 0 && step < 4 && (
          <button
            onClick={handleComplete}
            className="w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground mt-4 transition-colors"
          >
            Skip setup — I'll configure this later
          </button>
        )}
      </div>
    </div>
  );
}

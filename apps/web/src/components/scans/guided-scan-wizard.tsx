'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe, Server, Code, Cloud, Lock, Network, Database,
  ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle,
  Shield, Clock, HelpCircle, Eye, Wifi, Key, Info,
  Play, Loader2, X, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiPost } from '@/lib/api-client';
import { useUxStore } from '@/store/ux.store';
import toast from 'react-hot-toast';

interface ScanConfig {
  targets: string[];
  scanType: string;
  scannerProfile: string;
  authType: string;
  authCredentials: Record<string, string>;
  name: string;
  authorizedBy: string;
  confirmedOwnership: boolean;
  confirmedBackup: boolean;
  confirmedLowTraffic: boolean;
}

const SCAN_TYPE_OPTIONS = [
  {
    id: 'DISCOVERY',
    label: 'Quick Discovery Scan',
    icon: '🔍',
    description: 'Rapidly finds open doors (ports) on your target without actually testing them',
    analogy: 'Like walking around a building and counting how many doors and windows are visible from the outside',
    duration: '2–5 minutes',
    risk: 'Very Low',
    riskColor: 'green',
    bestFor: ['First-time users', 'Getting a quick overview', 'Checking what\'s exposed'],
    notFor: ['Finding security vulnerabilities', 'Testing login security'],
  },
  {
    id: 'PORT_SCAN',
    label: 'Network Port Scan',
    icon: '🚪',
    description: 'Finds all open network entry points and what software is running on them',
    analogy: 'Like checking every door and window, then trying to peek inside to see what\'s there',
    duration: '5–15 minutes',
    risk: 'Low',
    riskColor: 'green',
    bestFor: ['Network administrators', 'Finding exposed services', 'Inventory of network services'],
    notFor: ['Web application testing', 'Finding web vulnerabilities'],
  },
  {
    id: 'VULNERABILITY_ASSESSMENT',
    label: '🏆 Full Vulnerability Scan',
    icon: '🛡️',
    description: 'Comprehensive check for known security weaknesses using a database of 100,000+ known vulnerabilities',
    analogy: 'Like hiring a security consultant who tests every door, window, and lock against a list of known break-in techniques',
    duration: '15–60 minutes',
    risk: 'Medium',
    riskColor: 'amber',
    bestFor: ['Most users', 'Complete security check', 'Compliance requirements'],
    notFor: [],
    recommended: true,
  },
  {
    id: 'WEB_APPLICATION',
    label: 'Web Application Test',
    icon: '🌐',
    description: 'Tests your website or web app for common attack techniques like SQL injection, XSS, and broken authentication',
    analogy: 'Like having a skilled hacker (who you hired) try every known trick to break into your website',
    duration: '30–120 minutes',
    risk: 'Medium-High',
    riskColor: 'orange',
    bestFor: ['Website owners', 'Web app developers', 'OWASP compliance'],
    notFor: ['Servers without web services', 'Network devices'],
  },
  {
    id: 'API_SECURITY',
    label: 'API Security Test',
    icon: '⚙️',
    description: 'Tests your API endpoints for security vulnerabilities that could expose your data or allow unauthorized access',
    analogy: 'Like testing every channel your app uses to communicate with other systems to ensure they\'re secure',
    duration: '20–45 minutes',
    risk: 'Medium',
    riskColor: 'amber',
    bestFor: ['Mobile app backends', 'SaaS platforms', 'Microservices'],
    notFor: ['Traditional websites', 'Servers without APIs'],
  },
  {
    id: 'CODE_ANALYSIS',
    label: 'Source Code Review',
    icon: '💻',
    description: 'Analyzes your code for security bugs without running it — completely safe with no side effects',
    analogy: 'Like having an expert read every line of your code looking for mistakes that could create security holes',
    duration: '5–30 minutes',
    risk: 'None',
    riskColor: 'green',
    bestFor: ['Developers', 'DevSecOps teams', 'CI/CD pipelines'],
    notFor: ['Non-code targets', 'Running applications'],
  },
];

const WIZARD_STEPS = [
  { id: 1, title: 'What to Test', description: 'Enter your target' },
  { id: 2, title: 'Scan Type', description: 'Choose what kind of test' },
  { id: 3, title: 'Authentication', description: 'Login access (optional)' },
  { id: 4, title: 'Authorization', description: 'Confirm you have permission' },
  { id: 5, title: 'Launch', description: 'Review and start' },
];

export function GuidedScanWizard({ onClose, onComplete }: {
  onClose: () => void;
  onComplete: (scanId: string) => void;
}): JSX.Element {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<ScanConfig>({
    targets: [''],
    scanType: '',
    scannerProfile: 'standard',
    authType: 'none',
    authCredentials: {},
    name: '',
    authorizedBy: '',
    confirmedOwnership: false,
    confirmedBackup: false,
    confirmedLowTraffic: false,
  });
  const { isBeginnerMode } = useUxStore();
  const queryClient = useQueryClient();

  const createScanMutation = useMutation({
    mutationFn: (data: typeof config) =>
      apiPost<{ id: string }>('/scans', {
        name: data.name || `${data.scanType} Scan — ${data.targets[0]}`,
        scanType: data.scanType,
        targets: data.targets.filter((t) => t.trim()),
        configuration: {
          authType: data.authType,
          authCredentials: data.authType !== 'none' ? data.authCredentials : undefined,
        },
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['scans'] });
      toast.success('Scan started! You can track its progress in real-time.');
      onComplete(result.id);
    },
    onError: (error: Error) => {
      toast.error(`Failed to start scan: ${error.message}`);
    },
  });

  const updateTarget = (index: number, value: string): void => {
    const targets = [...config.targets];
    targets[index] = value;
    setConfig((c) => ({ ...c, targets }));
  };

  const validateStep = (): boolean => {
    if (step === 1) return config.targets.some((t) => t.trim().length > 0);
    if (step === 2) return config.scanType !== '';
    if (step === 4) return config.confirmedOwnership;
    return true;
  };

  const handleLaunch = (): void => {
    createScanMutation.mutate(config);
  };

  const selectedScanType = SCAN_TYPE_OPTIONS.find((s) => s.id === config.scanType);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              New Security Scan
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {step} of {WIZARD_STEPS.length} — {WIZARD_STEPS[step - 1]?.description}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="px-6 py-3 border-b border-border">
          <div className="flex items-center gap-1">
            {WIZARD_STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all',
                  step === s.id ? 'bg-primary text-primary-foreground' :
                  step > s.id ? 'text-primary' : 'text-muted-foreground',
                )}>
                  {step > s.id ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span>{s.id}</span>
                  )}
                  <span className="hidden sm:block">{s.title}</span>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={cn('h-0.5 flex-1', step > s.id ? 'bg-primary' : 'bg-border')} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* ─── Step 1: Target ──────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold mb-1">What do you want to test?</h3>
                    <p className="text-muted-foreground text-sm">
                      Enter the address of the website, server, or application you want to check for security issues.
                    </p>
                  </div>

                  {/* Beginner explanation */}
                  {isBeginnerMode() && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm">
                      <p className="font-semibold text-blue-400 flex items-center gap-2 mb-2">
                        <HelpCircle className="h-4 w-4" /> What is a target?
                      </p>
                      <p className="text-muted-foreground">
                        A <strong>target</strong> is the website, server, or application you want to test.
                        Think of it like entering an address on a map — you're telling us where to go look for problems.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        {[
                          { ok: true, example: 'https://mycompany.com', label: 'Your website' },
                          { ok: true, example: '192.168.1.100', label: 'Your server\'s IP address' },
                          { ok: true, example: 'api.myapp.com', label: 'Your API domain' },
                          { ok: false, example: 'google.com', label: 'Sites you don\'t own' },
                        ].map((ex) => (
                          <div key={ex.example} className={cn(
                            'flex items-center gap-1.5 p-2 rounded-lg',
                            ex.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
                          )}>
                            {ex.ok ? <Check className="h-3 w-3 flex-shrink-0" /> : <X className="h-3 w-3 flex-shrink-0" />}
                            <span className="font-mono">{ex.example}</span>
                            <span className="text-muted-foreground">{ex.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label className="font-semibold">
                      Target Address
                      <span className="text-destructive ml-1">*</span>
                    </Label>
                    {config.targets.map((target, i) => (
                      <div key={i} className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={target}
                          onChange={(e) => updateTarget(i, e.target.value)}
                          placeholder="e.g. https://mycompany.com or 192.168.1.100"
                          className="pl-9"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label className="font-semibold mb-2 block">
                      Give this scan a name (optional)
                    </Label>
                    <Input
                      value={config.name}
                      onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
                      placeholder="e.g. Production Website — Q3 2026"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      A descriptive name helps you find this scan later
                    </p>
                  </div>

                  {isBeginnerMode() && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-400">Important: Only test what you own</p>
                        <p className="text-muted-foreground mt-1">
                          Security scanning someone else's website without permission is illegal.
                          Only enter websites, servers, or applications that you own or have written permission to test.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Step 2: Scan Type ───────────────────────────── */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Choose what kind of test to run</h3>
                    <p className="text-muted-foreground text-sm">
                      Different tests look for different types of security issues. If you're not sure, choose "Full Vulnerability Scan" — it works for most cases.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {SCAN_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setConfig((c) => ({ ...c, scanType: option.id }))}
                        className={cn(
                          'w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                          config.scanType === option.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/40',
                        )}
                      >
                        <span className="text-2xl flex-shrink-0 mt-0.5">{option.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold">{option.label}</span>
                            {option.recommended && (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                ⭐ Recommended
                              </Badge>
                            )}
                            <Badge className={cn(
                              'text-xs',
                              option.riskColor === 'green' ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                              option.riskColor === 'amber' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                              'bg-orange-500/15 text-orange-400 border-orange-500/30',
                            )}>
                              Risk: {option.risk}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {option.duration}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                          {isBeginnerMode() && config.scanType === option.id && (
                            <div className="mt-2 p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                              <span className="font-medium">Think of it as:</span> {option.analogy}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {option.bestFor.map((use) => (
                              <span key={use} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                ✓ {use}
                              </span>
                            ))}
                          </div>
                        </div>
                        {config.scanType === option.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Step 3: Authentication ──────────────────────── */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Does your target require a login?</h3>
                    <p className="text-muted-foreground text-sm">
                      If your website or app requires you to log in first, we can test the protected areas too — this finds many more vulnerabilities.
                    </p>
                  </div>

                  {isBeginnerMode() && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm">
                      <p className="font-semibold text-blue-400 mb-2">💡 Why does this matter?</p>
                      <p className="text-muted-foreground">
                        Many security issues only appear when you're logged in. Without credentials, we can only test the "public" parts of your application — like checking a store's window display but not going inside.
                        With credentials, we test the entire application.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {[
                      { id: 'none', label: 'No login required', desc: 'Test only the public/unauthenticated parts', icon: Globe },
                      { id: 'basic', label: 'Username & Password', desc: 'Simple login with email/username and password', icon: Key },
                      { id: 'bearer', label: 'API Key / Token', desc: 'For APIs that use tokens for access', icon: Shield },
                      { id: 'form', label: 'Form-based Login', desc: 'Fill in a login form on a specific page', icon: Lock },
                    ].map((auth) => {
                      const Icon = auth.icon;
                      return (
                        <button
                          key={auth.id}
                          onClick={() => setConfig((c) => ({ ...c, authType: auth.id }))}
                          className={cn(
                            'w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all',
                            config.authType === auth.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
                          )}
                        >
                          <Icon className={cn('h-5 w-5 flex-shrink-0', config.authType === auth.id ? 'text-primary' : 'text-muted-foreground')} />
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{auth.label}</p>
                            <p className="text-xs text-muted-foreground">{auth.desc}</p>
                          </div>
                          {config.authType === auth.id && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {config.authType === 'basic' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
                      <p className="text-sm font-semibold">Test Account Credentials</p>
                      <p className="text-xs text-muted-foreground">
                        ⚠️ Use a <strong>test account</strong> — never your real admin credentials. Create a dedicated test user in your system.
                      </p>
                      <div className="space-y-2">
                        <Input
                          placeholder="Username or email (e.g. testuser@company.com)"
                          onChange={(e) => setConfig((c) => ({ ...c, authCredentials: { ...c.authCredentials, username: e.target.value } }))}
                        />
                        <Input
                          type="password"
                          placeholder="Password"
                          onChange={(e) => setConfig((c) => ({ ...c, authCredentials: { ...c.authCredentials, password: e.target.value } }))}
                        />
                      </div>
                    </motion.div>
                  )}

                  {config.authType === 'bearer' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
                      <p className="text-sm font-semibold">API Token</p>
                      <Input
                        placeholder="Bearer token or API key"
                        onChange={(e) => setConfig((c) => ({ ...c, authCredentials: { ...c.authCredentials, token: e.target.value } }))}
                      />
                    </motion.div>
                  )}
                </div>
              )}

              {/* ─── Step 4: Authorization ───────────────────────── */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Authorization Checklist ✅</h3>
                    <p className="text-muted-foreground text-sm">
                      Before we run the scan, please confirm a few important things. These protect both you and us.
                    </p>
                  </div>

                  {isBeginnerMode() && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm">
                      <p className="font-semibold text-amber-400 mb-2">⚖️ Why do we need this?</p>
                      <p className="text-muted-foreground">
                        Security scanning sends test requests to your target — similar to how a locksmith tests all your locks.
                        Without authorization, this could be considered unauthorized access.
                        These confirmations protect you legally and ensure we're only testing what we should.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {[
                      {
                        key: 'confirmedOwnership' as const,
                        label: 'I own or have written permission to test this target',
                        detail: 'You are the owner, system administrator, or have received written authorization from the owner to perform security testing.',
                        required: true,
                      },
                      {
                        key: 'confirmedBackup' as const,
                        label: 'I have a backup of my data (recommended)',
                        detail: 'While our scans are non-destructive, it\'s always good practice to have a backup. We highly recommend this for production systems.',
                        required: false,
                      },
                      {
                        key: 'confirmedLowTraffic' as const,
                        label: 'I understand this may slow my site temporarily (for active scans)',
                        detail: 'Some scan types send many requests to your target, which can temporarily increase server load. Running during low-traffic periods (nights/weekends) is recommended.',
                        required: false,
                      },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setConfig((c) => ({ ...c, [item.key]: !c[item.key] }))}
                        className={cn(
                          'w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                          config[item.key] ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30',
                        )}
                      >
                        <div className={cn(
                          'h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                          config[item.key] ? 'bg-primary border-primary' : 'border-muted-foreground',
                        )}>
                          {config[item.key] && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {item.label}
                            {item.required && <span className="text-destructive ml-1">*</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div>
                    <Label className="font-medium mb-2 block">Your name (for the authorization record)</Label>
                    <Input
                      value={config.authorizedBy}
                      onChange={(e) => setConfig((c) => ({ ...c, authorizedBy: e.target.value }))}
                      placeholder="Your full name"
                    />
                    <p className="text-xs text-muted-foreground mt-1">This is recorded in our audit log</p>
                  </div>
                </div>
              )}

              {/* ─── Step 5: Review & Launch ─────────────────────── */}
              {step === 5 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Review & Launch 🚀</h3>
                    <p className="text-muted-foreground text-sm">
                      Double-check everything below, then click "Start Scan" when you're ready.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        label: 'Target',
                        value: config.targets.filter((t) => t.trim()).join(', ') || '(not set)',
                        icon: Globe,
                      },
                      {
                        label: 'Scan Type',
                        value: selectedScanType ? `${selectedScanType.icon} ${selectedScanType.label}` : '(not set)',
                        icon: Shield,
                      },
                      {
                        label: 'Authentication',
                        value: config.authType === 'none' ? 'No login required' :
                               config.authType === 'basic' ? 'Username & Password' :
                               config.authType === 'bearer' ? 'API Token' : 'Form-based Login',
                        icon: Key,
                      },
                      {
                        label: 'Estimated Time',
                        value: selectedScanType?.duration ?? 'Unknown',
                        icon: Clock,
                      },
                    ].map((row) => {
                      const Icon = row.icon;
                      return (
                        <div key={row.label} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex items-center justify-between w-full">
                            <span className="text-sm text-muted-foreground">{row.label}</span>
                            <span className="text-sm font-medium">{row.value}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isBeginnerMode() && selectedScanType && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm">
                      <p className="font-semibold mb-2">💡 What will happen next?</p>
                      <ol className="space-y-1.5 text-muted-foreground">
                        {[
                          'We\'ll begin the scan immediately in the background',
                          'You\'ll see real-time progress with plain-language updates',
                          'Any issues found will be explained in simple terms',
                          'You\'ll get step-by-step instructions to fix everything found',
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                              {i + 1}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-400">Before you click Start Scan</p>
                      <p className="text-muted-foreground mt-0.5">
                        If you're scanning a production website, consider running this during off-peak hours.
                        The scan will create some extra traffic on your server.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/20">
          <Button
            variant="ghost"
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Step {step} of {WIZARD_STEPS.length}</span>
          </div>

          {step < 5 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!validateStep()}
              className="gap-1"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleLaunch}
              disabled={createScanMutation.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {createScanMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Starting...</>
              ) : (
                <><Play className="h-4 w-4" /> Start Scan</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

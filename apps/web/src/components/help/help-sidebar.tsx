'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle, Book, Video, MessageSquare, ExternalLink, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUxStore } from '@/store/ux.store';
import { cn } from '@/lib/utils';

interface PageHelpConfig {
  title: string;
  whatIsThis: string;
  whyItMatters: string;
  whoShouldUse: string;
  howToUse: string[];
  bestPractices: string[];
  commonMistakes: string[];
  faq: Array<{ question: string; answer: string }>;
  relatedConcepts: Array<{ name: string; concept: string }>;
}

const HELP_CONTENT: Record<string, PageHelpConfig> = {
  dashboard: {
    title: 'Security Dashboard',
    whatIsThis: 'The dashboard is your command center — a single screen that shows the current health of your security posture. Think of it as your organization\'s "security vital signs" monitor.',
    whyItMatters: 'Without visibility into your security status, you\'re essentially flying blind. The dashboard helps you quickly answer: "Are we safe right now? What should we fix first?"',
    whoShouldUse: 'Everyone from executives who need a quick overview to security engineers who need detailed metrics. The display adapts based on your role.',
    howToUse: [
      'Start with the top row — these cards show your most critical metrics at a glance',
      'Check "What to do today?" for prioritized action items',
      'The vulnerability trend graph shows if your security is improving over time',
      'Red or orange numbers need immediate attention',
    ],
    bestPractices: [
      'Check the dashboard every morning before starting work',
      'Set up email alerts for Critical vulnerabilities so you\'re notified immediately',
      'Review the "What changed since yesterday?" section daily',
      'Share the executive view with management monthly',
    ],
    commonMistakes: [
      'Focusing only on "Critical" severity and ignoring "High" — both need attention',
      'Not setting up notifications, so critical issues go unnoticed for days',
      'Treating the risk score as a grade — it\'s a direction indicator, not a score to game',
    ],
    faq: [
      {
        question: 'What does the risk score mean?',
        answer: 'The risk score is a 0-100 number that represents your overall security risk level. Higher = more risk. It\'s calculated from the number, severity, and exploitability of your open vulnerabilities.',
      },
      {
        question: 'Why are there vulnerabilities I didn\'t know about?',
        answer: 'Vulnerabilities are discovered in software all the time. When you installed software months ago, it might have been secure. Now it has known flaws. Our scanners detect these automatically.',
      },
      {
        question: 'What\'s a "SLA breach"?',
        answer: 'SLA stands for Service Level Agreement. We set deadlines for fixing vulnerabilities based on severity: Critical = 24 hours, High = 7 days, Medium = 30 days. A "breach" means you\'ve missed that deadline.',
      },
    ],
    relatedConcepts: [
      { name: 'CVSS Score', concept: 'cvss' },
      { name: 'Vulnerability', concept: 'vulnerability' },
      { name: 'Attack Surface', concept: 'attack-surface' },
    ],
  },
  scans: {
    title: 'Security Scans',
    whatIsThis: 'A scan is an automated security test that checks your systems for vulnerabilities. It\'s like hiring a very fast, tireless security expert who tests thousands of potential weaknesses in minutes.',
    whyItMatters: 'Without scanning, you won\'t know what vulnerabilities exist. Attackers actively scan for vulnerabilities 24/7. Regular scanning helps you find and fix issues before attackers do.',
    whoShouldUse: 'System administrators, security engineers, developers, and anyone responsible for keeping digital systems secure.',
    howToUse: [
      'Click "New Scan" and the wizard will guide you through every step',
      'Start with a "Quick Scan" if you\'re new — it\'s fast and safe',
      'Never scan systems you don\'t own without written permission',
      'Schedule regular scans (weekly or monthly) for ongoing monitoring',
    ],
    bestPractices: [
      'Always test against a staging/test environment before production',
      'Run scans during low-traffic hours (nights/weekends) to minimize impact',
      'Keep scan credentials in a secure password manager',
      'Review scan results within 24 hours of completion',
    ],
    commonMistakes: [
      'Scanning production systems during peak hours (can cause slowdowns)',
      'Using your personal admin credentials for scanning — always use dedicated test accounts',
      'Scanning systems you don\'t own — this can be illegal',
      'Ignoring scan results or delaying review for weeks',
    ],
    faq: [
      {
        question: 'Will a scan break my website?',
        answer: 'Standard scans are designed to be non-destructive. They send test requests similar to what a user would send, just faster and more systematically. However, we recommend running scans during low-traffic periods just in case.',
      },
      {
        question: 'How long does a scan take?',
        answer: 'It depends on the scan type and target size. A quick discovery scan takes 2-5 minutes. A full web application scan can take 30-120 minutes. We show estimated times in the scan wizard.',
      },
      {
        question: 'What\'s the difference between a quick scan and a full scan?',
        answer: 'A quick scan checks the most obvious vulnerabilities fast. A full scan does a comprehensive check of everything including less obvious issues. Full scans take longer but find more vulnerabilities.',
      },
    ],
    relatedConcepts: [
      { name: 'Port Scanning', concept: 'port-scanning' },
      { name: 'OWASP Top 10', concept: 'owasp-top10' },
      { name: 'Vulnerability Assessment', concept: 'vulnerability-assessment' },
    ],
  },
  vulnerabilities: {
    title: 'Vulnerabilities',
    whatIsThis: 'A vulnerability is a security weakness in your software, configuration, or network that an attacker could exploit to cause harm. Think of it as a cracked window or broken lock in your security.',
    whyItMatters: 'Every unfixed vulnerability is a potential way for attackers to break into your systems, steal data, or cause damage. The longer a vulnerability exists unpatched, the higher the risk.',
    whoShouldUse: 'Security engineers, system administrators, and developers who are responsible for fixing security issues.',
    howToUse: [
      'Sort by "Risk Score" to see the most dangerous issues first',
      'Filter by "SLA Breached" to see overdue fixes first',
      'Click on any vulnerability to see detailed fix instructions',
      'Use "Accept Risk" only with proper documentation and approval',
    ],
    bestPractices: [
      'Fix Critical vulnerabilities within 24 hours — no exceptions',
      'Fix High vulnerabilities within 7 days',
      'Always verify the fix by running a new scan after patching',
      'Document why you accepted risk for any vulnerability you don\'t fix',
    ],
    commonMistakes: [
      'Marking vulnerabilities as "False Positive" without proper verification',
      'Accepting risk without documenting the business justification',
      'Fixing the symptom (the alert) instead of the actual vulnerability',
      'Not re-scanning after applying a fix to verify it worked',
    ],
    faq: [
      {
        question: 'What\'s the difference between Critical, High, Medium, Low?',
        answer: 'These are severity levels based on CVSS score. Critical (9-10): Fix immediately — data breach risk. High (7-8.9): Fix this week. Medium (4-6.9): Fix this month. Low (1-3.9): Fix when convenient.',
      },
      {
        question: 'What is a CVE?',
        answer: 'CVE stands for Common Vulnerabilities and Exposures. It\'s a unique ID (like CVE-2024-12345) given to publicly documented security vulnerabilities. Think of it as a serial number for known security bugs.',
      },
      {
        question: 'What does "exploit available" mean?',
        answer: 'It means hackers have published working code or tools that can exploit this vulnerability. If a vulnerability has a public exploit, it\'s significantly more dangerous and should be prioritized for immediate fixing.',
      },
    ],
    relatedConcepts: [
      { name: 'CVE', concept: 'cve' },
      { name: 'CVSS Score', concept: 'cvss' },
      { name: 'Patch Management', concept: 'patch-management' },
    ],
  },
  assets: {
    title: 'Asset Inventory',
    whatIsThis: 'Your assets are all the digital things you own and need to protect: websites, servers, databases, APIs, applications, and network devices. An asset inventory is a complete list of everything you need to secure.',
    whyItMatters: 'You can\'t protect what you don\'t know about. An unknown server or forgotten application could be your biggest security risk. A complete asset inventory is the foundation of good security.',
    whoShouldUse: 'Security teams, system administrators, and IT managers who need to know what needs to be protected.',
    howToUse: [
      'Add your most critical assets first (databases, customer-facing applications)',
      'Set the correct "Criticality" level — this affects vulnerability prioritization',
      'Use tags to group related assets (by team, environment, or business unit)',
      'Use Asset Discovery to automatically find systems you might have missed',
    ],
    bestPractices: [
      'Classify every asset with a criticality level (Critical/High/Medium/Low)',
      'Mark which assets are Internet-facing — these need extra attention',
      'Keep the "owner" field up to date — someone needs to be responsible for each asset',
      'Run asset discovery monthly to catch new systems',
    ],
    commonMistakes: [
      'Not including "shadow IT" — systems created by teams without IT approval',
      'Forgetting cloud resources like S3 buckets, Lambda functions, or cloud databases',
      'Not updating asset lists when systems are decommissioned',
      'Setting everything to "Critical" — this defeats the prioritization purpose',
    ],
    faq: [
      {
        question: 'What\'s an "attack surface"?',
        answer: 'Your attack surface is everything an attacker could potentially target. Every asset, every open port, every web form, every API endpoint is part of your attack surface. Smaller attack surface = less risk.',
      },
      {
        question: 'What does "Internet-facing" mean?',
        answer: 'An internet-facing asset is accessible from the public internet. Your company website is internet-facing. Your internal HR database should NOT be internet-facing. Internet-facing assets have much higher risk.',
      },
    ],
    relatedConcepts: [
      { name: 'Attack Surface', concept: 'attack-surface' },
      { name: 'Asset Discovery', concept: 'asset-discovery' },
      { name: 'Network Segmentation', concept: 'network-segmentation' },
    ],
  },
  compliance: {
    title: 'Compliance Management',
    whatIsThis: 'Compliance means meeting specific security requirements set by governments, industries, or business agreements. SOC 2, ISO 27001, PCI DSS, HIPAA — these are all sets of rules you must follow to legally operate or win customers.',
    whyItMatters: 'Non-compliance can result in fines (GDPR fines can be 4% of global revenue), lawsuits, loss of contracts, and inability to process payments. Compliance also forces good security practices.',
    whoShouldUse: 'Compliance officers, security managers, CTOs, and anyone responsible for audits or regulatory requirements.',
    howToUse: [
      'Start with the framework your customers or regulators require',
      'Run an assessment to see where you currently stand',
      'Use the AI gap analysis to get prioritized remediation steps',
      'Track your progress as you implement controls',
    ],
    bestPractices: [
      'Don\'t wait for an audit to start — do continuous compliance monitoring',
      'Document everything — evidence collection is as important as implementation',
      'Assign a specific owner to each compliance control',
      'Automate evidence collection wherever possible',
    ],
    commonMistakes: [
      'Treating compliance as a checkbox exercise instead of real security improvement',
      'Only preparing for compliance right before an audit',
      'Not maintaining evidence throughout the year',
      'Confusing compliance with security — you can be compliant but still have major vulnerabilities',
    ],
    faq: [
      {
        question: 'What is SOC 2?',
        answer: 'SOC 2 is a security certification that proves your organization handles customer data securely. It\'s often required by enterprise customers before they\'ll do business with you. There are two types: Type I (point-in-time) and Type II (over 6-12 months).',
      },
      {
        question: 'Is PCI DSS required if we take credit cards?',
        answer: 'Yes. If you process, store, or transmit credit card data, you must comply with PCI DSS (Payment Card Industry Data Security Standard). Failure can result in loss of ability to accept card payments.',
      },
    ],
    relatedConcepts: [
      { name: 'SOC 2', concept: 'soc2' },
      { name: 'PCI DSS', concept: 'pci-dss' },
      { name: 'GDPR', concept: 'gdpr' },
    ],
  },
};

export function HelpSidebar(): JSX.Element {
  const { helpOpen, helpContext, closeHelp, openLearning } = useUxStore();
  const content = HELP_CONTENT[helpContext ?? 'dashboard'] ?? HELP_CONTENT['dashboard'];

  return (
    <AnimatePresence>
      {helpOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={closeHelp}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-bold">Help Center</p>
                  <p className="text-xs text-muted-foreground">{content.title}</p>
                </div>
              </div>
              <button onClick={closeHelp} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                <Tabs defaultValue="what">
                  <TabsList className="grid grid-cols-4 h-auto mb-4">
                    <TabsTrigger value="what" className="text-xs py-1.5">What is it?</TabsTrigger>
                    <TabsTrigger value="how" className="text-xs py-1.5">How to use</TabsTrigger>
                    <TabsTrigger value="tips" className="text-xs py-1.5">Best tips</TabsTrigger>
                    <TabsTrigger value="faq" className="text-xs py-1.5">FAQ</TabsTrigger>
                  </TabsList>

                  <TabsContent value="what" className="space-y-4 mt-0">
                    <Section title="📖 What is this page?">
                      <p className="text-sm text-muted-foreground leading-relaxed">{content.whatIsThis}</p>
                    </Section>
                    <Section title="❓ Why does it matter?">
                      <p className="text-sm text-muted-foreground leading-relaxed">{content.whyItMatters}</p>
                    </Section>
                    <Section title="👤 Who should use this?">
                      <p className="text-sm text-muted-foreground leading-relaxed">{content.whoShouldUse}</p>
                    </Section>
                    {content.relatedConcepts.length > 0 && (
                      <Section title="🔗 Related Concepts">
                        <div className="flex flex-wrap gap-2">
                          {content.relatedConcepts.map((concept) => (
                            <button
                              key={concept.concept}
                              onClick={() => openLearning(concept.concept)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors"
                            >
                              {concept.name} <ChevronRight className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      </Section>
                    )}
                  </TabsContent>

                  <TabsContent value="how" className="space-y-4 mt-0">
                    <Section title="📋 Step-by-step guide">
                      <ol className="space-y-3">
                        {content.howToUse.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold mt-0.5">
                              {i + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </Section>
                  </TabsContent>

                  <TabsContent value="tips" className="space-y-4 mt-0">
                    <Section title="✅ Best Practices">
                      <ul className="space-y-2">
                        {content.bestPractices.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </Section>
                    <Section title="⚠️ Common Mistakes to Avoid">
                      <ul className="space-y-2">
                        {content.commonMistakes.map((mistake, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-red-500 flex-shrink-0 mt-0.5">✗</span>
                            {mistake}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  </TabsContent>

                  <TabsContent value="faq" className="space-y-3 mt-0">
                    {content.faq.map((item, i) => (
                      <details key={i} className="border border-border rounded-xl overflow-hidden">
                        <summary className="flex items-center justify-between p-4 cursor-pointer font-medium text-sm hover:bg-muted/30">
                          {item.question}
                        </summary>
                        <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-border pt-3">
                          {item.answer}
                        </div>
                      </details>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground text-center">
                Need more help?{' '}
                <button
                  onClick={() => {/* open AI copilot */}}
                  className="text-primary hover:underline"
                >
                  Ask the AI Assistant
                </button>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-sm">{title}</p>
      {children}
    </div>
  );
}

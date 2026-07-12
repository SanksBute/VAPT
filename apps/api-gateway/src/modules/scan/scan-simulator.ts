import { createHash } from 'crypto';

import type { NormalizedFinding } from '@sentinelx/shared';

/**
 * Deterministic finding simulator — DEMO MODE ONLY.
 *
 * Only reachable from ScanExecutorService when `app.demoMode` (env
 * `SENTINELX_DEMO_MODE`) is enabled, as a stand-in when a real scanner binary
 * (nmap, nuclei, trivy, semgrep, …) is not available. It produces realistic,
 * well-formed findings, every one stamped `source: 'SIMULATED'`, so the full
 * scan pipeline (queue → executor → results → vulnerabilities → dashboard) can
 * be exercised end-to-end without the external tooling installed — and so
 * simulated output can never be mistaken for a real assessment result.
 *
 * Findings are deterministic for a given (scanner, target) pair so repeated scans
 * of the same target de-duplicate cleanly via their fingerprints.
 */

type Severity = NormalizedFinding['severity'];

interface FindingSeed {
  title: string;
  description: string;
  severity: Severity;
  port?: number;
  protocol?: string;
  service?: string;
  url?: string;
  parameter?: string;
  method?: string;
  cveIds?: string[];
  cweIds?: string[];
  cvssV3Score?: number;
  cvssV3Vector?: string;
  solution?: string;
  references?: string[];
  evidence?: string;
  pluginId?: string;
}

function fingerprint(scanner: string, target: string, seed: FindingSeed): string {
  return createHash('sha256')
    .update(
      `${scanner}|${target}|${seed.title}|${seed.port ?? ''}|${seed.url ?? ''}|${seed.parameter ?? ''}`,
    )
    .digest('hex');
}

/** Pick a stable subset of an array based on a target-derived hash. */
function stableSubset<T>(items: T[], target: string, min: number, max: number): T[] {
  const hash = createHash('md5').update(target).digest();
  const count = min + ((hash[0] ?? 0) % Math.max(1, max - min + 1));
  const start = (hash[1] ?? 0) % items.length;
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, items.length); i++) {
    const item = items[(start + i) % items.length];
    if (item !== undefined) {
      out.push(item);
    }
  }
  return out;
}

function toFinding(scanner: string, target: string, seed: FindingSeed): NormalizedFinding {
  return {
    scanner,
    pluginId: seed.pluginId,
    title: seed.title,
    description: seed.description,
    severity: seed.severity,
    source: 'SIMULATED',
    target,
    port: seed.port,
    protocol: seed.protocol,
    service: seed.service,
    url: seed.url,
    parameter: seed.parameter,
    method: seed.method,
    cveIds: seed.cveIds ?? [],
    cweIds: seed.cweIds ?? [],
    cvssV3Score: seed.cvssV3Score,
    cvssV3Vector: seed.cvssV3Vector,
    solution: seed.solution,
    references: seed.references ?? [],
    evidence: seed.evidence,
    fingerprint: fingerprint(scanner, target, seed),
    rawData: { simulated: true },
  };
}

const NETWORK_SEEDS: FindingSeed[] = [
  {
    title: 'Open SSH service detected',
    severity: 'INFORMATIONAL',
    port: 22,
    protocol: 'tcp',
    service: 'ssh',
    description:
      'An SSH service is exposed. Ensure it enforces key-based authentication and disables root login.',
    solution:
      'Restrict SSH access with a firewall, disable password authentication, and disable root login.',
    cweIds: ['CWE-284'],
  },
  {
    title: 'Exposed HTTP service without TLS',
    severity: 'MEDIUM',
    port: 80,
    protocol: 'tcp',
    service: 'http',
    description:
      'Plain HTTP is served without redirecting to HTTPS, allowing traffic interception.',
    solution: 'Redirect all HTTP traffic to HTTPS and enable HSTS.',
    cweIds: ['CWE-319'],
    cvssV3Score: 5.3,
  },
  {
    title: 'Outdated OpenSSL version on TLS service',
    severity: 'HIGH',
    port: 443,
    protocol: 'tcp',
    service: 'https',
    description: 'The TLS service reports an OpenSSL version affected by known vulnerabilities.',
    solution: 'Upgrade OpenSSL to the latest supported release and restart dependent services.',
    cveIds: ['CVE-2023-0286'],
    cweIds: ['CWE-476'],
    cvssV3Score: 7.4,
    references: ['https://www.openssl.org/news/vulnerabilities.html'],
  },
  {
    title: 'Database port exposed to network',
    severity: 'CRITICAL',
    port: 5432,
    protocol: 'tcp',
    service: 'postgresql',
    description:
      'A PostgreSQL database port is reachable. Databases should never be exposed directly to untrusted networks.',
    solution: 'Bind the database to localhost or a private subnet and place it behind a firewall.',
    cweIds: ['CWE-1327'],
    cvssV3Score: 9.1,
  },
  {
    title: 'SMB service exposed',
    severity: 'HIGH',
    port: 445,
    protocol: 'tcp',
    service: 'microsoft-ds',
    description:
      'An SMB file-sharing service is exposed and may be vulnerable to remote exploitation.',
    solution: 'Block SMB at the network perimeter and apply the latest OS patches.',
    cveIds: ['CVE-2017-0144'],
    cweIds: ['CWE-20'],
    cvssV3Score: 8.1,
  },
];

const WEB_SEEDS: FindingSeed[] = [
  {
    title: 'Reflected Cross-Site Scripting (XSS)',
    severity: 'HIGH',
    parameter: 'q',
    method: 'GET',
    description:
      'User input in the "q" parameter is reflected in the response without encoding, enabling script injection.',
    solution: 'Context-aware output encoding and a strict Content-Security-Policy.',
    cweIds: ['CWE-79'],
    cvssV3Score: 7.2,
    evidence: 'Payload <script>alert(1)</script> was reflected unencoded in the response body.',
  },
  {
    title: 'SQL Injection in login form',
    severity: 'CRITICAL',
    parameter: 'username',
    method: 'POST',
    description:
      'The username field is vulnerable to SQL injection, allowing authentication bypass and data extraction.',
    solution: 'Use parameterized queries / prepared statements and validate all input.',
    cweIds: ['CWE-89'],
    cvssV3Score: 9.8,
    evidence: "Payload ' OR '1'='1 altered the query result and bypassed authentication.",
  },
  {
    title: 'Missing security headers',
    severity: 'LOW',
    description:
      'Responses omit X-Content-Type-Options, X-Frame-Options, and Content-Security-Policy headers.',
    solution: 'Add standard security headers at the web server or application layer.',
    cweIds: ['CWE-693'],
    cvssV3Score: 3.1,
  },
  {
    title: 'Cookie without Secure and HttpOnly flags',
    severity: 'MEDIUM',
    description:
      'A session cookie is set without the Secure and HttpOnly attributes, exposing it to theft.',
    solution: 'Set Secure, HttpOnly, and SameSite attributes on all session cookies.',
    cweIds: ['CWE-614'],
    cvssV3Score: 5.4,
  },
  {
    title: 'Directory listing enabled',
    severity: 'MEDIUM',
    url: '/uploads/',
    description:
      'Directory listing is enabled, disclosing file names and structure to anonymous users.',
    solution: 'Disable auto-indexing in the web server configuration.',
    cweIds: ['CWE-548'],
    cvssV3Score: 5.3,
  },
];

const CONTAINER_SEEDS: FindingSeed[] = [
  {
    title: 'Vulnerable package: openssl 1.1.1k',
    severity: 'HIGH',
    description: 'The image bundles openssl 1.1.1k which is affected by multiple known CVEs.',
    solution: 'Rebuild the image on an updated base image and upgrade the openssl package.',
    cveIds: ['CVE-2022-0778'],
    cweIds: ['CWE-835'],
    cvssV3Score: 7.5,
  },
  {
    title: 'Vulnerable package: log4j 2.14.1',
    severity: 'CRITICAL',
    description:
      'The image contains log4j 2.14.1, vulnerable to the Log4Shell remote code execution flaw.',
    solution: 'Upgrade log4j to 2.17.1 or later.',
    cveIds: ['CVE-2021-44228'],
    cweIds: ['CWE-502'],
    cvssV3Score: 10.0,
    references: ['https://logging.apache.org/log4j/2.x/security.html'],
  },
  {
    title: 'Container runs as root',
    severity: 'MEDIUM',
    description:
      'The container is configured to run as the root user, increasing the blast radius of a compromise.',
    solution: 'Add a non-root USER directive in the Dockerfile and drop unnecessary capabilities.',
    cweIds: ['CWE-250'],
    cvssV3Score: 5.0,
  },
  {
    title: 'Sensitive file included in image layer',
    severity: 'HIGH',
    description: 'A private key file was found baked into an image layer.',
    solution: 'Remove secrets from the image and inject them at runtime via a secrets manager.',
    cweIds: ['CWE-538'],
    cvssV3Score: 7.0,
  },
];

const CODE_SEEDS: FindingSeed[] = [
  {
    title: 'Hard-coded API key in source',
    severity: 'HIGH',
    url: 'src/config/keys.ts',
    description:
      'A hard-coded credential was detected in the source tree and may be exposed in version control.',
    solution:
      'Move secrets to environment variables or a secrets manager and rotate the exposed key.',
    cweIds: ['CWE-798'],
    cvssV3Score: 7.5,
    evidence: 'const STRIPE_KEY = "sk_live_…" detected in committed code.',
  },
  {
    title: 'Use of dangerous eval()',
    severity: 'MEDIUM',
    url: 'src/utils/parse.ts',
    description:
      'Dynamic code execution via eval() can lead to remote code execution when fed untrusted input.',
    solution: 'Replace eval() with a safe parser (e.g. JSON.parse) or an allow-list.',
    cweIds: ['CWE-95'],
    cvssV3Score: 6.3,
  },
  {
    title: 'Command injection via child_process',
    severity: 'CRITICAL',
    url: 'src/services/exec.ts',
    description:
      'User-controlled input is concatenated into a shell command, enabling command injection.',
    solution:
      'Use execFile with an argument array and validate inputs; never build shell strings from user input.',
    cweIds: ['CWE-78'],
    cvssV3Score: 9.4,
  },
  {
    title: 'Weak hashing algorithm (MD5)',
    severity: 'LOW',
    url: 'src/auth/hash.ts',
    description: 'MD5 is used for hashing sensitive values; it is cryptographically broken.',
    solution: 'Use a modern algorithm such as bcrypt, scrypt, or Argon2 for password hashing.',
    cweIds: ['CWE-327'],
    cvssV3Score: 3.7,
  },
];

const CLOUD_SEEDS: FindingSeed[] = [
  {
    title: 'Public S3 bucket',
    severity: 'CRITICAL',
    description: 'A storage bucket allows public read access, potentially exposing sensitive data.',
    solution: 'Enable Block Public Access and scope bucket policies to least privilege.',
    cweIds: ['CWE-732'],
    cvssV3Score: 9.1,
  },
  {
    title: 'IAM user with overly permissive policy',
    severity: 'HIGH',
    description:
      'An IAM principal is attached to a wildcard (*:*) policy, granting excessive privileges.',
    solution: 'Apply least-privilege IAM policies scoped to specific actions and resources.',
    cweIds: ['CWE-269'],
    cvssV3Score: 8.2,
  },
  {
    title: 'Security group allows 0.0.0.0/0 on all ports',
    severity: 'HIGH',
    description: 'A security group permits inbound traffic from any source on all ports.',
    solution: 'Restrict inbound rules to required ports and known source ranges.',
    cweIds: ['CWE-284'],
    cvssV3Score: 7.6,
  },
  {
    title: 'Cloud storage encryption disabled',
    severity: 'MEDIUM',
    description: 'At-rest encryption is not enabled for a storage resource.',
    solution: 'Enable server-side encryption using a managed or customer-managed key.',
    cweIds: ['CWE-311'],
    cvssV3Score: 5.5,
  },
];

const SCANNER_PROFILE = new Map<string, FindingSeed[]>([
  ['NMAP', NETWORK_SEEDS],
  ['MASSCAN', NETWORK_SEEDS],
  ['RUSTSCAN', NETWORK_SEEDS],
  ['OPENVAS', [...NETWORK_SEEDS, ...WEB_SEEDS]],
  ['NUCLEI', WEB_SEEDS],
  ['ZAP', WEB_SEEDS],
  ['NIKTO', WEB_SEEDS],
  ['SQLMAP', WEB_SEEDS.filter((s) => s.cweIds?.includes('CWE-89'))],
  ['TRIVY', CONTAINER_SEEDS],
  ['SEMGREP', CODE_SEEDS],
  ['MOBSF', CODE_SEEDS],
  ['SCOUTSUITE', CLOUD_SEEDS],
  ['PROWLER', CLOUD_SEEDS],
  ['LYNIS', NETWORK_SEEDS],
  ['OSQUERY', NETWORK_SEEDS],
  ['FALCO', NETWORK_SEEDS],
  ['CUSTOM', WEB_SEEDS],
]);

/**
 * Generate simulated findings for a scanner against a target.
 * Returns a stable subset so repeated scans dedupe cleanly.
 */
export function simulateFindings(scanner: string, target: string): NormalizedFinding[] {
  const seeds = SCANNER_PROFILE.get(scanner) ?? WEB_SEEDS;
  const chosen = stableSubset(seeds, target, 2, Math.min(4, seeds.length));

  return chosen.map((seed) => {
    const withUrl =
      seed.url !== undefined && !seed.url.startsWith('http')
        ? {
            ...seed,
            url: `${target.replace(/\/$/, '')}${seed.url.startsWith('/') ? '' : '/'}${seed.url}`,
          }
        : seed;
    return toFinding(scanner, target, withUrl);
  });
}

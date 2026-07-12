import { execFile } from 'child_process';
import { promisify } from 'util';

import type { NormalizedFinding } from '@sentinelx/shared';

import { BaseScanner } from '../base/base-scanner';
import type { ScannerContext, ScannerMetadata } from '../interfaces/scanner.interface';

const execFileAsync = promisify(execFile);

const TRIVY_SEVERITY_ALLOWLIST = new Set(['critical', 'high', 'medium', 'low', 'unknown']);
const TRIVY_SCAN_TYPE_ALLOWLIST = new Set(['image', 'fs', 'repo', 'k8s']);
const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-./:@]+$/;

export class TrivyParser extends BaseScanner {
  readonly metadata: ScannerMetadata = {
    type: 'TRIVY',
    version: '0.52.0',
    displayName: 'Trivy',
    description: 'Comprehensive vulnerability scanner for containers, filesystems, and cloud',
    supportedScanTypes: [
      'CONTAINER_SECURITY',
      'CODE_ANALYSIS',
      'SECRET_DETECTION',
      'KUBERNETES_SECURITY',
    ],
    supportedTargetTypes: ['container_image', 'repository', 'file_path'],
    requiresCredentials: false,
    supportsParallel: true,
    supportsResume: false,
    maxTargets: 100,
    defaultTimeout: 3600,
    outputFormat: 'json',
    executablePath: '/usr/local/bin/trivy',
    dockerImage: 'aquasec/trivy:latest',
  };

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('trivy', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('trivy', ['--version']);
      const match = /Version: (\S+)/.exec(stdout);
      return match?.[1] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async scan(context: ScannerContext): Promise<string> {
    const { target, configuration, workDir, timeout } = context;
    const outputFile = `${workDir}/trivy-${context.jobId}.json`;

    if (!SAFE_PATH_REGEX.test(target)) {
      throw new Error(`Invalid Trivy target rejected: ${target}`);
    }

    const scanType = this.determineScanType(
      target,
      configuration as unknown as Record<string, unknown>,
    );
    const args = this.buildTrivyArgs(
      target,
      scanType,
      configuration as unknown as Record<string, unknown>,
      outputFile,
    );

    await context.onEvent('scan_started', `Starting Trivy scan on ${target}`, { args });
    await context.onProgress(5, 'Downloading Trivy database');

    await execFileAsync('trivy', args, {
      timeout: timeout * 1000,
      maxBuffer: 500 * 1024 * 1024,
      cwd: workDir,
    }).catch(() => undefined);

    const fs = await import('fs/promises');
    try {
      return await fs.readFile(outputFile, 'utf-8');
    } catch {
      return '';
    }
  }

  parse(rawOutput: string, context: ScannerContext): Promise<NormalizedFinding[]> {
    const findings: NormalizedFinding[] = [];
    if (!rawOutput.trim()) {
      return Promise.resolve(findings);
    }

    let report: TrivyReport;
    try {
      report = JSON.parse(rawOutput) as TrivyReport;
    } catch {
      return Promise.resolve(findings);
    }

    const results = Array.isArray(report.Results) ? report.Results : [];

    for (const result of results) {
      // Vulnerabilities
      for (const vuln of result.Vulnerabilities ?? []) {
        const cvssScore = this.extractCvssScore(vuln);
        const severity =
          cvssScore !== undefined
            ? this.cvssScoreToSeverity(cvssScore)
            : this.mapSeverity(vuln.Severity ?? 'info');

        findings.push({
          scanner: 'TRIVY',
          pluginId: vuln.VulnerabilityID,
          title: vuln.Title ?? vuln.VulnerabilityID ?? 'Unknown Vulnerability',
          description: vuln.Description ?? '',
          severity,
          target: context.target,
          affectedComponent: `${vuln.PkgName}@${vuln.InstalledVersion}`,
          fixedVersion: vuln.FixedVersion,
          cveIds:
            vuln.VulnerabilityID !== undefined && vuln.VulnerabilityID !== ''
              ? [vuln.VulnerabilityID]
              : [],
          cweIds: [],
          cvssV3Score: cvssScore,
          cvssV3Vector: vuln.CVSS?.nvd?.V3Vector ?? vuln.CVSS?.redhat?.V3Vector,
          solution:
            vuln.FixedVersion !== undefined && vuln.FixedVersion !== ''
              ? `Update to version ${vuln.FixedVersion}`
              : undefined,
          references: vuln.References ?? [],
          fingerprint: this.generateFingerprint({
            vulnId: vuln.VulnerabilityID,
            pkg: vuln.PkgName,
            target: context.target,
          }),
        } as NormalizedFinding & { affectedComponent?: string; fixedVersion?: string });
      }

      // Secrets
      for (const secret of result.Secrets ?? []) {
        findings.push({
          scanner: 'TRIVY',
          pluginId: `secret-${secret.RuleID}`,
          title: `Secret Detected: ${secret.Title ?? secret.RuleID}`,
          description: `Secret found in ${result.Target}: ${secret.Category} — ${secret.Title}`,
          severity: 'CRITICAL',
          target: context.target,
          url: result.Target,
          cveIds: [],
          cweIds: ['CWE-798'],
          solution: 'Remove the hardcoded secret and rotate the credential immediately.',
          evidence: secret.Match,
          references: [],
          fingerprint: this.generateFingerprint({
            ruleId: secret.RuleID,
            target: result.Target,
          }),
        });
      }

      // Misconfigurations
      for (const misconf of result.Misconfigurations ?? []) {
        const severity = this.mapSeverity(misconf.Severity ?? 'info');
        findings.push({
          scanner: 'TRIVY',
          pluginId: misconf.ID,
          title: misconf.Title ?? misconf.ID ?? 'Misconfiguration',
          description: misconf.Description ?? '',
          severity,
          target: context.target,
          url: result.Target,
          cveIds: [],
          cweIds: [],
          solution: misconf.Resolution ?? undefined,
          references: misconf.References ?? [],
          fingerprint: this.generateFingerprint({
            id: misconf.ID,
            target: result.Target,
          }),
        });
      }
    }

    return Promise.resolve(findings);
  }

  private buildTrivyArgs(
    target: string,
    scanType: string,
    config: Record<string, unknown>,
    outputFile: string,
  ): string[] {
    const args: string[] = [scanType, '--format', 'json', '--output', outputFile];

    const severity = config['severity'] as string[] | undefined;
    if (severity && severity.length > 0) {
      for (const s of severity) {
        if (!TRIVY_SEVERITY_ALLOWLIST.has(s.toLowerCase())) {
          throw new Error(`Invalid Trivy severity rejected: ${s}`);
        }
      }
      args.push('--severity', severity.join(',').toUpperCase());
    }

    if (
      config['ignoredVulns'] !== undefined &&
      config['ignoredVulns'] !== null &&
      config['ignoredVulns'] !== ''
    ) {
      const ignoreFile = String(config['ignoredVulns']);
      if (!SAFE_PATH_REGEX.test(ignoreFile) || ignoreFile.includes('..')) {
        throw new Error(`Invalid Trivy ignore file path rejected: ${ignoreFile}`);
      }
      args.push('--ignorefile', ignoreFile);
    }

    if (config['offline'] === true) {
      args.push('--offline-scan');
    }

    if (scanType === 'image' || scanType === 'fs') {
      args.push('--scanners', 'vuln,secret,config');
    }

    if (scanType === 'k8s') {
      args.push('--report', 'all');
    }

    args.push(target);
    return args;
  }

  private determineScanType(target: string, config: Record<string, unknown>): string {
    const explicitType = config['trivyScanType'] as string | undefined;
    if (explicitType !== undefined && explicitType !== '') {
      if (!TRIVY_SCAN_TYPE_ALLOWLIST.has(explicitType)) {
        throw new Error(`Invalid Trivy scan type rejected: ${explicitType}`);
      }
      return explicitType;
    }

    if (target.includes('/') && !target.startsWith('http')) {
      return 'fs';
    }

    if (target.includes(':') && !target.includes('://')) {
      return 'image';
    }

    return 'image';
  }

  private extractCvssScore(vuln: TrivyVulnerability): number | undefined {
    if (vuln.CVSS?.nvd?.V3Score !== undefined) {
      return vuln.CVSS.nvd.V3Score;
    }
    if (vuln.CVSS?.redhat?.V3Score !== undefined) {
      return vuln.CVSS.redhat.V3Score;
    }
    return undefined;
  }
}

interface TrivyReport {
  Results?: TrivyResult[];
}

interface TrivyResult {
  Target?: string;
  Type?: string;
  Vulnerabilities?: TrivyVulnerability[];
  Secrets?: TrivySecret[];
  Misconfigurations?: TrivyMisconfiguration[];
}

interface TrivyVulnerability {
  VulnerabilityID?: string;
  PkgName?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Title?: string;
  Description?: string;
  Severity?: string;
  References?: string[];
  CVSS?: {
    nvd?: { V3Score?: number; V3Vector?: string; V2Score?: number };
    redhat?: { V3Score?: number; V3Vector?: string };
  };
}

interface TrivySecret {
  RuleID?: string;
  Category?: string;
  Title?: string;
  Severity?: string;
  Match?: string;
}

interface TrivyMisconfiguration {
  ID?: string;
  Title?: string;
  Description?: string;
  Severity?: string;
  Resolution?: string;
  References?: string[];
}

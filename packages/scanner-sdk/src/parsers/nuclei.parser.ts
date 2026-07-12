import { execFile } from 'child_process';
import { promisify } from 'util';

import { isValidScanTarget, type NormalizedFinding } from '@sentinelx/shared';

import { BaseScanner } from '../base/base-scanner';
import type { ScannerContext, ScannerMetadata } from '../interfaces/scanner.interface';

const execFileAsync = promisify(execFile);

const NUCLEI_TAG_REGEX = /^[a-zA-Z0-9_-]+$/;
const NUCLEI_SEVERITY_ALLOWLIST = new Set(['critical', 'high', 'medium', 'low', 'info', 'unknown']);
const NUCLEI_TEMPLATE_REGEX = /^[a-zA-Z0-9_\-./]+$/;
const TEMPLATE_ID_KEY = 'template-id';
const CVSS_SCORE_KEY = 'cvss-score';

export class NucleiParser extends BaseScanner {
  readonly metadata: ScannerMetadata = {
    type: 'NUCLEI',
    version: '3.2.0',
    displayName: 'Nuclei',
    description: 'Fast and customizable vulnerability scanner based on templates',
    supportedScanTypes: [
      'VULNERABILITY_ASSESSMENT',
      'WEB_APPLICATION',
      'API_SECURITY',
      'DISCOVERY',
    ],
    supportedTargetTypes: ['url', 'ip', 'hostname', 'domain'],
    requiresCredentials: false,
    supportsParallel: true,
    supportsResume: false,
    maxTargets: 1000,
    defaultTimeout: 7200,
    outputFormat: 'json',
    executablePath: '/usr/local/bin/nuclei',
    dockerImage: 'projectdiscovery/nuclei:latest',
  };

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('nuclei', ['-version']);
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const { stderr } = await execFileAsync('nuclei', ['-version']);
      const match = /Nuclei Engine Version: v?(\S+)/i.exec(stderr);
      return match?.[1] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async scan(context: ScannerContext): Promise<string> {
    const { target, configuration, workDir, timeout } = context;
    const outputFile = `${workDir}/nuclei-${context.jobId}.jsonl`;

    if (!isValidScanTarget(target) && !this.isValidHttpUrl(target)) {
      throw new Error(`Invalid scan target rejected: ${target}`);
    }

    const args = this.buildNucleiArgs(
      target,
      configuration as unknown as Record<string, unknown>,
      outputFile,
    );

    await context.onEvent('scan_started', `Starting Nuclei scan on ${target}`, { args });
    await context.onProgress(5, 'Running Nuclei templates');

    await execFileAsync('nuclei', args, {
      timeout: timeout * 1000,
      maxBuffer: 200 * 1024 * 1024,
      cwd: workDir,
    }).catch(() => undefined); // Nuclei exits with non-zero on findings

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

    const lines = rawOutput
      .trim()
      .split('\n')
      .filter((l) => l.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as NucleiResult;
        const finding = this.mapNucleiResult(entry, context.target);
        if (finding) {
          findings.push(finding);
        }
      } catch {
        continue;
      }
    }

    return Promise.resolve(findings);
  }

  private isValidHttpUrl(value: string): boolean {
    if (/\s/.test(value)) {
      return false;
    }
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private buildNucleiArgs(
    target: string,
    config: Record<string, unknown>,
    outputFile: string,
  ): string[] {
    const args: string[] = ['-target', target];

    args.push('-json-export', outputFile);
    args.push('-silent', '-no-color');

    const tags = config['tags'] as string[] | undefined;
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        if (!NUCLEI_TAG_REGEX.test(tag)) {
          throw new Error(`Invalid Nuclei tag rejected: ${tag}`);
        }
      }
      args.push('-tags', tags.join(','));
    }

    const severity = config['severity'] as string[] | undefined;
    if (severity && severity.length > 0) {
      for (const s of severity) {
        if (!NUCLEI_SEVERITY_ALLOWLIST.has(s.toLowerCase())) {
          throw new Error(`Invalid Nuclei severity rejected: ${s}`);
        }
      }
      args.push('-severity', severity.join(','));
    } else {
      args.push('-severity', 'critical,high,medium,low,info');
    }

    const templates = config['templates'] as string[] | undefined;
    if (templates && templates.length > 0) {
      for (const t of templates) {
        if (!NUCLEI_TEMPLATE_REGEX.test(t) || t.includes('..')) {
          throw new Error(`Invalid Nuclei template path rejected: ${t}`);
        }
        args.push('-t', t);
      }
    }

    const rateLimit = config['rateLimit'] as number | undefined;
    if (rateLimit !== undefined) {
      if (!Number.isInteger(rateLimit) || rateLimit <= 0 || rateLimit > 1_000_000) {
        throw new Error(`Invalid rate limit rejected: ${String(rateLimit)}`);
      }
      args.push('-rate-limit', String(rateLimit));
    } else {
      args.push('-rate-limit', '150');
    }

    const concurrency = config['parallelism'] as number | undefined;
    if (
      concurrency !== undefined &&
      (!Number.isInteger(concurrency) || concurrency <= 0 || concurrency > 1000)
    ) {
      throw new Error(`Invalid parallelism rejected: ${String(concurrency)}`);
    }
    args.push('-c', String(concurrency ?? 25));

    if (config['headless'] === true) {
      args.push('-headless');
    }

    return args;
  }

  private mapNucleiResult(result: NucleiResult, defaultTarget: string): NormalizedFinding | null {
    if (!result.info) {
      return null;
    }

    const severity = this.mapSeverity(result.info.severity ?? 'info');
    const cveIds = this.extractCveIds(
      [result.info.name ?? '', ...(result.info.reference ?? [])].join(' '),
    );

    // TEMPLATE_ID_KEY is a fixed internal constant, not attacker input
    // eslint-disable-next-line security/detect-object-injection
    const templateId = result[TEMPLATE_ID_KEY];

    return {
      scanner: 'NUCLEI',
      pluginId: result.template ?? templateId,
      title: result.info.name ?? templateId ?? 'Unknown',
      description: result.info.description ?? templateId ?? '',
      severity,
      target: result.host ?? result.matched ?? defaultTarget,
      url: result.matched ?? undefined,
      port: result.port !== undefined && result.port !== '' ? parseInt(result.port, 10) : undefined,
      protocol: result.scheme,
      cveIds,
      cweIds: this.extractCweIds(result.info.name ?? ''),
      cvssV3Score: this.extractCvssScore(result.info),
      solution: Array.isArray(result.info.remediation)
        ? result.info.remediation.join('\n')
        : result.info.remediation,
      references: result.info.reference ?? [],
      evidence: result.response ?? result['extracted-results']?.join('\n'),
      request: result.request,
      response: result.response,
      fingerprint: this.generateFingerprint({
        templateId,
        host: result.host,
        matched: result.matched,
      }),
    };
  }

  private extractCvssScore(info: NucleiInfo): number | undefined {
    // CVSS_SCORE_KEY is a fixed internal constant, not attacker input
    // eslint-disable-next-line security/detect-object-injection
    const cvssScore = info.classification?.[CVSS_SCORE_KEY];
    if (cvssScore !== undefined) {
      return parseFloat(String(cvssScore));
    }
    return undefined;
  }
}

interface NucleiResult {
  'template-id'?: string;
  template?: string;
  info?: NucleiInfo;
  host?: string;
  matched?: string;
  port?: string;
  scheme?: string;
  request?: string;
  response?: string;
  'extracted-results'?: string[];
  timestamp?: string;
}

interface NucleiInfo {
  name?: string;
  description?: string;
  severity?: string;
  reference?: string[];
  remediation?: string | string[];
  classification?: {
    'cvss-score'?: number | string;
    'cvss-metrics'?: string;
    'cve-id'?: string | string[];
    'cwe-id'?: string | string[];
  };
}

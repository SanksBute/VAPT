import type { NormalizedFinding } from '@sentinelx/shared';
import { XMLParser } from 'fast-xml-parser';
import { BaseScanner } from '../base/base-scanner';
import type { ScannerContext, ScannerMetadata } from '../interfaces/scanner.interface';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class NucleiParser extends BaseScanner {
  readonly metadata: ScannerMetadata = {
    type: 'NUCLEI',
    version: '3.2.0',
    displayName: 'Nuclei',
    description: 'Fast and customizable vulnerability scanner based on templates',
    supportedScanTypes: ['VULNERABILITY_ASSESSMENT', 'WEB_APPLICATION', 'API_SECURITY', 'DISCOVERY'],
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
      await execAsync('nuclei -version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const { stderr } = await execAsync('nuclei -version');
      const match = /Nuclei Engine Version: v?(\S+)/i.exec(stderr);
      return match?.[1] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async scan(context: ScannerContext): Promise<string> {
    const { target, configuration, workDir, timeout } = context;
    const outputFile = `${workDir}/nuclei-${context.jobId}.jsonl`;

    const args = this.buildNucleiArgs(target, configuration as unknown as Record<string, unknown>, outputFile);
    const command = `nuclei ${args.join(' ')}`;

    await context.onEvent('scan_started', `Starting Nuclei scan on ${target}`);
    await context.onProgress(5, 'Running Nuclei templates');

    await execAsync(command, {
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

  async parse(rawOutput: string, context: ScannerContext): Promise<NormalizedFinding[]> {
    const findings: NormalizedFinding[] = [];
    if (!rawOutput.trim()) return findings;

    const lines = rawOutput.trim().split('\n').filter((l) => l.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as NucleiResult;
        const finding = this.mapNucleiResult(entry, context.target);
        if (finding) findings.push(finding);
      } catch {
        continue;
      }
    }

    return findings;
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
      args.push('-tags', tags.join(','));
    }

    const severity = config['severity'] as string[] | undefined;
    if (severity && severity.length > 0) {
      args.push('-severity', severity.join(','));
    } else {
      args.push('-severity', 'critical,high,medium,low,info');
    }

    const templates = config['templates'] as string[] | undefined;
    if (templates && templates.length > 0) {
      for (const t of templates) {
        args.push('-t', t);
      }
    }

    const rateLimit = config['rateLimit'] as number | undefined;
    if (rateLimit) {
      args.push('-rate-limit', String(rateLimit));
    } else {
      args.push('-rate-limit', '150');
    }

    const concurrency = config['parallelism'] as number | undefined;
    args.push('-c', String(concurrency ?? 25));

    if (config['headless'] === true) {
      args.push('-headless');
    }

    return args;
  }

  private mapNucleiResult(
    result: NucleiResult,
    defaultTarget: string,
  ): NormalizedFinding | null {
    if (!result.info) return null;

    const severity = this.mapSeverity(result.info.severity ?? 'info');
    const cveIds = this.extractCveIds(
      [result.info.name ?? '', ...(result.info.reference ?? [])].join(' '),
    );

    return {
      scanner: 'NUCLEI',
      pluginId: result.template ?? result['template-id'],
      title: result.info.name ?? result['template-id'] ?? 'Unknown',
      description: result.info.description ?? result['template-id'] ?? '',
      severity,
      target: result.host ?? result.matched ?? defaultTarget,
      url: result.matched ?? undefined,
      port: result.port ? parseInt(result.port, 10) : undefined,
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
        templateId: result['template-id'],
        host: result.host,
        matched: result.matched,
      }),
    };
  }

  private extractCvssScore(info: NucleiInfo): number | undefined {
    if (info.classification?.['cvss-score'] !== undefined) {
      return parseFloat(String(info.classification['cvss-score']));
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

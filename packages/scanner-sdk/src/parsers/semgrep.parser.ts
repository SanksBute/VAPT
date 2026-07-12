import { execFile } from 'child_process';
import { promisify } from 'util';

import type { NormalizedFinding } from '@sentinelx/shared';

import { BaseScanner } from '../base/base-scanner';
import type { ScannerContext, ScannerMetadata } from '../interfaces/scanner.interface';

const execFileAsync = promisify(execFile);

const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-./:@]+$/;
const SEMGREP_RULESET_REGEX = /^(?:p\/[a-zA-Z0-9_-]+|[a-zA-Z0-9_\-./]+)$/;

export class SemgrepParser extends BaseScanner {
  readonly metadata: ScannerMetadata = {
    type: 'SEMGREP',
    version: '1.75.0',
    displayName: 'Semgrep',
    description: 'Static analysis tool for finding bugs and enforcing code standards',
    supportedScanTypes: ['CODE_ANALYSIS', 'SECRET_DETECTION'],
    supportedTargetTypes: ['repository', 'file_path'],
    requiresCredentials: false,
    supportsParallel: true,
    supportsResume: false,
    maxTargets: 50,
    defaultTimeout: 7200,
    outputFormat: 'json',
    executablePath: '/usr/local/bin/semgrep',
    dockerImage: 'semgrep/semgrep:latest',
  };

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('semgrep', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('semgrep', ['--version']);
      return stdout.trim().split('\n')[0] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async scan(context: ScannerContext): Promise<string> {
    const { target, configuration, workDir, timeout } = context;
    const outputFile = `${workDir}/semgrep-${context.jobId}.json`;

    if (!SAFE_PATH_REGEX.test(target)) {
      throw new Error(`Invalid Semgrep target rejected: ${target}`);
    }

    const args = this.buildSemgrepArgs(
      target,
      configuration as unknown as Record<string, unknown>,
      outputFile,
    );

    await context.onEvent('scan_started', `Starting Semgrep analysis on ${target}`, { args });
    await context.onProgress(5, 'Running Semgrep rules');

    await execFileAsync('semgrep', args, {
      timeout: timeout * 1000,
      maxBuffer: 200 * 1024 * 1024,
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
    if (!rawOutput.trim()) {
      return Promise.resolve([]);
    }

    let report: SemgrepReport;
    try {
      report = JSON.parse(rawOutput) as SemgrepReport;
    } catch {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      (report.results ?? []).map((result) => {
        const severity = this.mapSemgrepSeverity(result.extra?.severity ?? 'warning');
        const check = result.check_id ?? '';
        const cwe = result.extra?.metadata?.cwe;
        const cweText = Array.isArray(cwe) ? cwe.join(',') : (cwe ?? '');

        return {
          scanner: 'SEMGREP',
          pluginId: check,
          title: result.extra?.message ?? check,
          description: result.extra?.message ?? '',
          severity,
          target: context.target,
          url: `${result.path}:${result.start?.line}`,
          cveIds: this.extractCveIds(check + (result.extra?.message ?? '')),
          cweIds: this.extractCweIds(check + cweText),
          solution: result.extra?.metadata?.fix ?? undefined,
          evidence: result.extra?.lines ?? undefined,
          references: result.extra?.metadata?.references ?? [],
          fingerprint: this.generateFingerprint({
            checkId: check,
            path: result.path,
            line: result.start?.line,
          }),
        };
      }),
    );
  }

  private buildSemgrepArgs(
    target: string,
    config: Record<string, unknown>,
    outputFile: string,
  ): string[] {
    const args: string[] = ['--json', '--output', outputFile];

    const rulesets = config['rulesets'] as string[] | undefined;
    if (rulesets && rulesets.length > 0) {
      for (const r of rulesets) {
        if (!SEMGREP_RULESET_REGEX.test(r) || r.includes('..')) {
          throw new Error(`Invalid Semgrep ruleset rejected: ${r}`);
        }
        args.push('--config', r);
      }
    } else {
      args.push('--config', 'p/security-audit');
      args.push('--config', 'p/owasp-top-ten');
      args.push('--config', 'p/secrets');
      args.push('--config', 'p/cwe-top-25');
    }

    const exclude = config['exclude'] as string[] | undefined;
    if (exclude && exclude.length > 0) {
      for (const e of exclude) {
        if (!SAFE_PATH_REGEX.test(e)) {
          throw new Error(`Invalid Semgrep exclude pattern rejected: ${e}`);
        }
        args.push('--exclude', e);
      }
    }

    args.push('--no-rewrite-rule-ids');
    args.push('--timeout', String((config['timeout'] as number | undefined) ?? 30));
    args.push(target);
    return args;
  }

  private mapSemgrepSeverity(
    severity: string,
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' {
    const mapping: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL'> = {
      ERROR: 'HIGH',
      WARNING: 'MEDIUM',
      INFO: 'LOW',
      CRITICAL: 'CRITICAL',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    };
    return mapping[severity.toUpperCase()] ?? 'INFORMATIONAL';
  }
}

interface SemgrepReport {
  results?: SemgrepResult[];
  errors?: unknown[];
  stats?: unknown;
}

interface SemgrepResult {
  check_id?: string;
  path?: string;
  start?: { line?: number; col?: number };
  end?: { line?: number; col?: number };
  extra?: {
    message?: string;
    severity?: string;
    lines?: string;
    metadata?: {
      cwe?: string | string[];
      owasp?: string | string[];
      references?: string[];
      fix?: string;
      confidence?: string;
    };
  };
}

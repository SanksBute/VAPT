import type { NormalizedFinding } from '@sentinelx/shared';
import type {
  IScanner,
  ScannerContext,
  ScannerMetadata,
  ScannerValidationResult,
} from '../interfaces/scanner.interface';

export abstract class BaseScanner implements IScanner {
  abstract readonly metadata: ScannerMetadata;
  protected initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const available = await this.isAvailable();
    if (!available) {
      throw new Error(
        `Scanner ${this.metadata.displayName} is not available. ` +
          `Please ensure the binary is installed or Docker is running.`,
      );
    }
    this.initialized = true;
  }

  async validate(context: ScannerContext): Promise<ScannerValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!context.target || context.target.trim().length === 0) {
      errors.push('Target is required');
    }

    if (context.timeout <= 0) {
      errors.push('Timeout must be positive');
    }

    if (context.timeout > 86400) {
      warnings.push('Timeout exceeds 24 hours — consider splitting into smaller scans');
    }

    if (!this.metadata.supportedTargetTypes.includes(context.targetType)) {
      errors.push(
        `Target type '${context.targetType}' is not supported by ${this.metadata.displayName}. ` +
          `Supported types: ${this.metadata.supportedTargetTypes.join(', ')}`,
      );
    }

    const customValidation = await this.customValidate(context);
    errors.push(...customValidation.errors);
    warnings.push(...customValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      resolvedTarget: context.target,
    };
  }

  abstract scan(context: ScannerContext): Promise<string>;
  abstract parse(rawOutput: string, context: ScannerContext): Promise<NormalizedFinding[]>;
  abstract isAvailable(): Promise<boolean>;
  abstract getVersion(): Promise<string>;

  normalize(findings: NormalizedFinding[], _context: ScannerContext): NormalizedFinding[] {
    const seen = new Set<string>();
    const unique: NormalizedFinding[] = [];

    for (const finding of findings) {
      const key = `${finding.scanner}-${finding.pluginId ?? ''}-${finding.target}-${finding.port ?? ''}-${finding.url ?? ''}-${finding.parameter ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(finding);
      }
    }

    return unique.sort((a, b) => {
      const severityOrder = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
        INFORMATIONAL: 4,
      };
      return (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5);
    });
  }

  async generateEvidence(
    _finding: NormalizedFinding,
    _context: ScannerContext,
  ): Promise<Record<string, unknown>> {
    return {};
  }

  async cleanup(context: ScannerContext): Promise<void> {
    await context.onEvent('cleanup', `Cleaning up scanner resources`, {
      jobId: context.jobId,
    });
  }

  protected async customValidate(
    _context: ScannerContext,
  ): Promise<ScannerValidationResult> {
    return { isValid: true, errors: [], warnings: [] };
  }

  protected generateFingerprint(data: Record<string, unknown>): string {
    const crypto = require('crypto') as typeof import('crypto');
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
  }

  protected mapSeverity(
    rawSeverity: string,
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' {
    const severity = rawSeverity.toUpperCase().trim();
    const mapping: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL'> = {
      CRITICAL: 'CRITICAL',
      CRIT: 'CRITICAL',
      URGENT: 'CRITICAL',
      HIGH: 'HIGH',
      IMPORTANT: 'HIGH',
      MEDIUM: 'MEDIUM',
      MODERATE: 'MEDIUM',
      WARN: 'MEDIUM',
      WARNING: 'MEDIUM',
      LOW: 'LOW',
      MINOR: 'LOW',
      INFO: 'INFORMATIONAL',
      INFORMATIONAL: 'INFORMATIONAL',
      INFORMATION: 'INFORMATIONAL',
      NOTE: 'INFORMATIONAL',
      LOG: 'INFORMATIONAL',
      DEBUG: 'INFORMATIONAL',
    };
    return mapping[severity] ?? 'INFORMATIONAL';
  }

  protected cvssScoreToSeverity(
    score: number,
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' {
    if (score >= 9.0) return 'CRITICAL';
    if (score >= 7.0) return 'HIGH';
    if (score >= 4.0) return 'MEDIUM';
    if (score > 0) return 'LOW';
    return 'INFORMATIONAL';
  }

  protected extractCveIds(text: string): string[] {
    const cveRegex = /CVE-\d{4}-\d{4,7}/gi;
    const matches = text.match(cveRegex) ?? [];
    return [...new Set(matches.map((c) => c.toUpperCase()))];
  }

  protected extractCweIds(text: string): string[] {
    const cweRegex = /CWE-\d{1,4}/gi;
    const matches = text.match(cweRegex) ?? [];
    return [...new Set(matches.map((c) => c.toUpperCase()))];
  }
}

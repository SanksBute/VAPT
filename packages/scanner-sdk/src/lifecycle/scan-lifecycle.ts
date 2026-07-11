import type { ScannerContext, ScannerResult, ScannerStatistics } from '../interfaces/scanner.interface';
import type { ScannerRegistry } from '../registry/scanner.registry';
import type { NormalizedFinding, ScannerTypeValue } from '@sentinelx/shared';

export interface ScanLifecycleOptions {
  registry: ScannerRegistry;
  onProgress?: (jobId: string, progress: number, message?: string) => Promise<void>;
  onEvent?: (jobId: string, type: string, message: string, data?: Record<string, unknown>) => Promise<void>;
  onComplete?: (result: ScannerResult) => Promise<void>;
  onError?: (jobId: string, error: Error) => Promise<void>;
}

export class ScanLifecycle {
  constructor(private readonly options: ScanLifecycleOptions) {}

  async execute(
    scannerType: ScannerTypeValue,
    context: ScannerContext,
  ): Promise<ScannerResult> {
    const startedAt = new Date();
    let rawOutput = '';
    let findings: NormalizedFinding[] = [];

    const contextWithCallbacks: ScannerContext = {
      ...context,
      onProgress: async (progress, message) => {
        await this.options.onProgress?.(context.jobId, progress, message);
      },
      onEvent: async (type, message, data) => {
        await this.options.onEvent?.(context.jobId, type, message, data);
      },
    };

    try {
      const scanner = this.options.registry.get(scannerType);

      // Phase 1: Initialize
      await scanner.initialize();
      await contextWithCallbacks.onProgress(2, 'Scanner initialized');

      // Phase 2: Validate
      const validation = await scanner.validate(contextWithCallbacks);
      if (!validation.isValid) {
        throw new Error(`Scan validation failed: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length > 0) {
        await contextWithCallbacks.onEvent(
          'validation_warning',
          `Validation warnings: ${validation.warnings.join(', ')}`,
        );
      }

      await contextWithCallbacks.onProgress(5, 'Validation passed');

      // Phase 3: Scan
      rawOutput = await scanner.scan(contextWithCallbacks);
      await contextWithCallbacks.onProgress(70, 'Scan complete, parsing results');

      // Phase 4: Parse
      const rawFindings = await scanner.parse(rawOutput, contextWithCallbacks);
      await contextWithCallbacks.onProgress(80, `Parsed ${rawFindings.length} raw findings`);

      // Phase 5: Normalize (dedup, severity mapping, fingerprinting)
      findings = scanner.normalize(rawFindings, contextWithCallbacks);
      await contextWithCallbacks.onProgress(90, `Normalized to ${findings.length} unique findings`);

      // Phase 6: Generate evidence for critical/high findings
      for (const finding of findings.filter((f) => ['CRITICAL', 'HIGH'].includes(f.severity))) {
        const evidence = await scanner.generateEvidence(finding, contextWithCallbacks).catch(() => ({}));
        if (Object.keys(evidence).length > 0) {
          finding.rawData = { ...finding.rawData, evidence };
        }
      }

      // Phase 7: Cleanup
      await scanner.cleanup(contextWithCallbacks);
      await contextWithCallbacks.onProgress(100, 'Scan lifecycle complete');

      const completedAt = new Date();
      const result: ScannerResult = {
        jobId: context.jobId,
        scanId: context.scanId,
        scanner: scannerType,
        target: context.target,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: true,
        findings,
        rawOutput,
        metadata: {
          validationWarnings: validation.warnings,
          resolvedTarget: validation.resolvedTarget,
        },
        statistics: this.calculateStatistics(findings, startedAt, completedAt),
      };

      await this.options.onComplete?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.options.onError?.(context.jobId, err);

      const completedAt = new Date();
      const result: ScannerResult = {
        jobId: context.jobId,
        scanId: context.scanId,
        scanner: scannerType,
        target: context.target,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        success: false,
        errorMessage: err.message,
        findings: [],
        rawOutput,
        metadata: {},
        statistics: this.calculateStatistics([], startedAt, completedAt),
      };

      return result;
    }
  }

  private calculateStatistics(
    findings: NormalizedFinding[],
    startedAt: Date,
    completedAt: Date,
  ): ScannerStatistics {
    return {
      totalFindings: findings.length,
      criticalFindings: findings.filter((f) => f.severity === 'CRITICAL').length,
      highFindings: findings.filter((f) => f.severity === 'HIGH').length,
      mediumFindings: findings.filter((f) => f.severity === 'MEDIUM').length,
      lowFindings: findings.filter((f) => f.severity === 'LOW').length,
      infoFindings: findings.filter((f) => f.severity === 'INFORMATIONAL').length,
      scanDurationSeconds: Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000),
    };
  }
}

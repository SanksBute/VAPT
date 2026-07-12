import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScanStatus } from '@prisma/client';
import type { IScanner, ScannerContext, ScannerTargetType } from '@sentinelx/scanner-sdk';
import {
  NmapParser,
  NucleiParser,
  SemgrepParser,
  TrivyParser,
  ZapParser,
} from '@sentinelx/scanner-sdk';
import type { NormalizedFinding } from '@sentinelx/shared';
import { QUEUES } from '@sentinelx/shared';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

import { ScanProgressGateway } from './scan-progress.gateway';
import { simulateFindings } from './scan-simulator';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Hard cap (seconds) on how long a real scanner binary may run before we abandon
 * it. Real tools like nuclei only report progress at the very start and end, so
 * without a cap a slow scan against a live target appears frozen indefinitely.
 * Exceeding this cap fails the job (or falls back to simulation in DEMO_MODE) —
 * it never silently reports COMPLETED.
 */
const MAX_REAL_SCAN_SECONDS = 120;

interface ScanJobDispatch {
  jobId: string;
  scanId: string;
  organizationId: string;
  scanner: string;
  target: string;
  targetType: string;
  configuration: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}

interface ScanResultMessage {
  scanId: string;
  jobId: string;
  scanner: string;
  organizationId: string;
  findings: unknown[];
  success: boolean;
  errorMessage?: string;
  statistics: Record<string, unknown>;
  /** True when `findings` came from the DEMO_MODE simulator, not a real scan. */
  demoMode?: boolean;
}

@Injectable()
export class ScanExecutorService implements OnModuleInit {
  private readonly scanners = new Map<string, IScanner>([
    ['NMAP', new NmapParser()],
    ['NUCLEI', new NucleiParser()],
    ['ZAP', new ZapParser()],
    ['TRIVY', new TrivyParser()],
    ['SEMGREP', new SemgrepParser()],
  ]);

  constructor(
    @InjectPinoLogger(ScanExecutorService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly gateway: ScanProgressGateway,
    private readonly config: ConfigService,
  ) {}

  private isDemoMode(): boolean {
    return this.config.get<boolean>('app.demoMode') ?? false;
  }

  async onModuleInit(): Promise<void> {
    await this.queue.consume<ScanJobDispatch>(QUEUES.SCAN_JOBS, async (message) => {
      await this.executeJob(message.payload);
    });

    this.logger.info('Scan executor service initialized — consuming scan jobs');
  }

  private async executeJob(job: ScanJobDispatch): Promise<void> {
    const scanner = this.scanners.get(job.scanner);
    const demoMode = this.isDemoMode();

    await this.prisma.scannerJob.update({
      where: { id: job.jobId },
      data: { status: ScanStatus.RUNNING, startedAt: new Date() },
    });

    await this.markScanStarted(job.scanId);

    // No real scanner implementation registered for this type.
    if (!scanner) {
      if (demoMode) {
        const findings = await this.runSimulated(job);
        await this.publishResult({
          scanId: job.scanId,
          jobId: job.jobId,
          scanner: job.scanner,
          organizationId: job.organizationId,
          findings,
          success: true,
          statistics: this.buildStatistics(findings),
          demoMode: true,
        });
        return;
      }

      this.logger.error(
        { jobId: job.jobId, scanner: job.scanner },
        'No scanner implementation registered',
      );
      await this.publishResult({
        scanId: job.scanId,
        jobId: job.jobId,
        scanner: job.scanner,
        organizationId: job.organizationId,
        findings: [],
        success: false,
        errorMessage: `Scanner ${job.scanner} is not implemented`,
        statistics: { totalFindings: 0 },
      });
      return;
    }

    const workDir = path.join(os.tmpdir(), 'sentinelx-scans', job.jobId);
    await fs.mkdir(workDir, { recursive: true });

    const context: ScannerContext = {
      jobId: job.jobId,
      scanId: job.scanId,
      organizationId: job.organizationId,
      target: job.target,
      targetType: job.targetType as ScannerTargetType,
      configuration: job.configuration,
      credentials: job.credentials,
      workDir,
      outputDir: workDir,
      timeout: Math.min(
        (job.configuration['timeout'] as number | undefined) ?? MAX_REAL_SCAN_SECONDS,
        MAX_REAL_SCAN_SECONDS,
      ),
      onProgress: async (progress, message) => {
        await this.updateProgress(job.scanId, job.jobId, progress, message);
      },
      onEvent: (type, message, data) => {
        this.logger.info({ jobId: job.jobId, type, data }, message);
        return Promise.resolve();
      },
    };

    try {
      const available = await scanner.isAvailable().catch(() => false);

      let normalized: NormalizedFinding[];
      let usedSimulation = false;

      if (available) {
        // Real scanner binary present — run it with a live progress heartbeat
        // and a hard time cap.
        try {
          normalized = await this.runRealWithHeartbeat(scanner, context, job);
        } catch (realError) {
          if (!demoMode) {
            // Outside demo mode, a real-scan failure/timeout fails the job —
            // it never silently substitutes fabricated findings.
            throw realError;
          }
          this.logger.warn(
            { err: realError, jobId: job.jobId, scanner: job.scanner },
            'DEMO_MODE: real scan failed or timed out — falling back to simulation',
          );
          normalized = await this.runSimulated(job);
          usedSimulation = true;
        }
      } else if (demoMode) {
        this.logger.warn(
          { jobId: job.jobId, scanner: job.scanner },
          'DEMO_MODE: scanner binary unavailable — using simulation fallback',
        );
        normalized = await this.runSimulated(job);
        usedSimulation = true;
      } else {
        throw new Error(`Scanner binary ${job.scanner} not installed`);
      }

      const statistics = this.buildStatistics(normalized);

      await this.publishResult({
        scanId: job.scanId,
        jobId: job.jobId,
        scanner: job.scanner,
        organizationId: job.organizationId,
        findings: normalized,
        success: true,
        statistics,
        demoMode: usedSimulation,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Scan execution failed';
      this.logger.error({ error, jobId: job.jobId, target: job.target }, 'Scanner job failed');

      await this.publishResult({
        scanId: job.scanId,
        jobId: job.jobId,
        scanner: job.scanner,
        organizationId: job.organizationId,
        findings: [],
        success: false,
        errorMessage,
        statistics: { totalFindings: 0 },
      });
    } finally {
      await scanner.cleanup(context).catch(() => undefined);
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * Run a real scanner while emitting a periodic progress heartbeat, so the UI
   * shows steady movement even though the tool itself only reports 5% → 90%.
   * The heartbeat ramps toward ~85% and stops once the scan resolves.
   */
  private async runRealWithHeartbeat(
    scanner: IScanner,
    context: ScannerContext,
    job: ScanJobDispatch,
  ): Promise<NormalizedFinding[]> {
    let progress = 8;
    const heartbeat = setInterval(() => {
      progress = Math.min(progress + 5, 85);
      void this.updateProgress(job.scanId, job.jobId, progress, 'Scanning target…');
    }, 3000);

    try {
      await scanner.initialize();
      const validation = await scanner.validate(context);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      const rawOutput = await scanner.scan(context);
      const findings = await scanner.parse(rawOutput, context);
      return scanner.normalize(findings, context);
    } finally {
      clearInterval(heartbeat);
    }
  }

  /** Produce simulated findings with a short, realistic progress sequence. */
  private async runSimulated(job: ScanJobDispatch): Promise<NormalizedFinding[]> {
    const steps: Array<[number, string]> = [
      [10, `Preparing ${job.scanner} scan of ${job.target}`],
      [35, 'Enumerating target surface'],
      [65, 'Analyzing responses'],
      [90, 'Correlating findings'],
    ];

    for (const [progress, message] of steps) {
      await this.updateProgress(job.scanId, job.jobId, progress, message);
      await sleep(700);
    }

    return simulateFindings(job.scanner, job.target);
  }

  private async markScanStarted(scanId: string): Promise<void> {
    await this.prisma.scan.updateMany({
      where: { id: scanId, status: { in: [ScanStatus.PENDING, ScanStatus.QUEUED] } },
      data: { status: ScanStatus.RUNNING, startedAt: new Date() },
    });
  }

  private async updateProgress(
    scanId: string,
    jobId: string,
    progress: number,
    message?: string,
  ): Promise<void> {
    await this.prisma.scannerJob.update({
      where: { id: jobId },
      data: { progress: Math.max(0, Math.min(100, Math.round(progress))) },
    });

    const jobs = await this.prisma.scannerJob.findMany({
      where: { scanId },
      select: { progress: true },
    });

    const overallProgress =
      jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + j.progress, 0) / jobs.length) : 0;

    const scan = await this.prisma.scan.update({
      where: { id: scanId },
      data: { progress: overallProgress },
      select: { organizationId: true },
    });

    this.gateway.emitScanProgress(scan.organizationId, scanId, {
      scanId,
      status: 'RUNNING',
      progress: overallProgress,
      totalTargets: jobs.length,
      scannedTargets: jobs.filter((j) => j.progress >= 100).length,
      findings: 0,
      activeJobs: jobs.filter((j) => j.progress > 0 && j.progress < 100).length,
      completedJobs: jobs.filter((j) => j.progress >= 100).length,
      failedJobs: 0,
      events:
        message !== undefined && message !== ''
          ? [{ timestamp: new Date().toISOString(), type: 'progress', message, severity: 'info' }]
          : [],
    });
  }

  private buildStatistics(findings: Array<{ severity: string }>): Record<string, unknown> {
    return {
      totalFindings: findings.length,
      criticalFindings: findings.filter((f) => f.severity === 'CRITICAL').length,
      highFindings: findings.filter((f) => f.severity === 'HIGH').length,
      mediumFindings: findings.filter((f) => f.severity === 'MEDIUM').length,
      lowFindings: findings.filter((f) => f.severity === 'LOW').length,
      infoFindings: findings.filter((f) => f.severity === 'INFORMATIONAL').length,
    };
  }

  private async publishResult(result: ScanResultMessage): Promise<void> {
    await this.queue.sendToQueue(QUEUES.SCAN_RESULTS, {
      type: 'scanner.job.completed',
      payload: result,
      organizationId: result.organizationId,
      timestamp: new Date().toISOString(),
    });
  }
}

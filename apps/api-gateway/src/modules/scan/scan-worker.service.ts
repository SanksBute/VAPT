import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScanStatus } from '@prisma/client';
import type { VulnerabilityCategory } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { ScanProgressGateway } from './scan-progress.gateway';
import { QUEUES, EVENTS, NOTIFICATION_EVENTS } from '@sentinelx/shared';
import type { ScanProgress } from '@sentinelx/shared';

interface ScanJobMessage {
  scanId: string;
  organizationId: string;
  scanType: string;
  targets: string[];
  configuration: Record<string, unknown>;
  priority: number;
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
}

@Injectable()
export class ScanWorkerService implements OnModuleInit {
  constructor(
    @InjectPinoLogger(ScanWorkerService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
    private readonly gateway: ScanProgressGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    // Subscribe to scan result events from scanner workers
    await this.queue.consume<ScanResultMessage>(
      QUEUES.SCAN_RESULTS,
      async (message) => {
        await this.processScanResult(message.payload);
      },
    );

    this.logger.info('Scan worker service initialized — consuming scan results');
  }

  private async processScanResult(result: ScanResultMessage): Promise<void> {
    const { scanId, organizationId } = result;

    try {
      if (!result.success) {
        this.logger.warn({ scanId, error: result.errorMessage }, 'Scanner job failed');
        await this.handleJobFailure(result);
        return;
      }

      // Process findings and create vulnerabilities
      if (result.findings.length > 0) {
        await this.processFindings(scanId, organizationId, result);
      }

      // Update job status
      await this.prisma.scannerJob.updateMany({
        where: { id: result.jobId },
        data: {
          status: ScanStatus.COMPLETED,
          completedAt: new Date(),
          rawOutput: JSON.stringify(result.findings).substring(0, 100000),
        },
      });

      // Check if all jobs are complete
      await this.checkScanCompletion(scanId, organizationId);
    } catch (error) {
      this.logger.error({ error, scanId }, 'Failed to process scan result');
    }
  }

  private async processFindings(
    scanId: string,
    organizationId: string,
    result: ScanResultMessage,
  ): Promise<void> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { targets: true },
    });
    if (!scan) return;

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let infoCount = 0;

    const findings = result.findings as Array<{
      title: string;
      description: string;
      severity: string;
      target: string;
      port?: number;
      protocol?: string;
      url?: string;
      parameter?: string;
      cveIds?: string[];
      cweIds?: string[];
      cvssV3Score?: number;
      cvssV3Vector?: string;
      solution?: string;
      references?: string[];
      evidence?: string;
      request?: string;
      response?: string;
      fingerprint: string;
      pluginId?: string;
    }>;

    for (const finding of findings) {
      const severity = finding.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

      if (severity === 'CRITICAL') criticalCount++;
      else if (severity === 'HIGH') highCount++;
      else if (severity === 'MEDIUM') mediumCount++;
      else if (severity === 'LOW') lowCount++;
      else infoCount++;

      // Check for duplicate vulnerability
      const existingVuln = await this.prisma.vulnerability.findFirst({
        where: {
          organizationId,
          fingerprint: finding.fingerprint,
          status: { notIn: ['RESOLVED', 'FALSE_POSITIVE'] },
        },
      });

      if (existingVuln) {
        // Update last detected timestamp
        await this.prisma.vulnerability.update({
          where: { id: existingVuln.id },
          data: {
            lastDetectedAt: new Date(),
            reoccurrenceCount: { increment: 1 },
          },
        });
      } else {
        // Create new vulnerability
        const slaDeadline = new Date();
        const slaDays = { CRITICAL: 1, HIGH: 7, MEDIUM: 30, LOW: 90, INFORMATIONAL: 180 };
        slaDeadline.setDate(slaDeadline.getDate() + (slaDays[severity] ?? 90));

        const vuln = await this.prisma.vulnerability.create({
          data: {
            organizationId,
            scanId,
            title: finding.title,
            description: finding.description,
            severity,
            status: 'OPEN',
            category: this.determineCategoryFromFinding(finding),
            cveIds: finding.cveIds ?? [],
            cweIds: finding.cweIds ?? [],
            cvssV3Score: finding.cvssV3Score,
            cvssV3Vector: finding.cvssV3Vector,
            solution: finding.solution,
            references: finding.references ?? [],
            proof: finding.evidence,
            request: finding.request,
            response: finding.response,
            scanner: result.scanner,
            pluginId: finding.pluginId,
            fingerprint: finding.fingerprint,
            slaDeadline,
            riskScore: finding.cvssV3Score ? finding.cvssV3Score * 10 : severity === 'CRITICAL' ? 90 : severity === 'HIGH' ? 70 : severity === 'MEDIUM' ? 50 : 20,
          },
        });

        // Associate with asset
        const asset = await this.prisma.asset.findFirst({
          where: {
            organizationId,
            OR: [
              { identifier: finding.target },
              { ipAddresses: { has: finding.target } },
              { hostname: finding.target },
            ],
          },
        });

        if (asset) {
          await this.prisma.assetVulnerability.create({
            data: {
              assetId: asset.id,
              vulnerabilityId: vuln.id,
              port: finding.port,
              protocol: finding.protocol,
              url: finding.url,
              parameter: finding.parameter,
            },
          });
        }

        // Emit critical/high findings via WebSocket immediately
        if (severity === 'CRITICAL' || severity === 'HIGH') {
          this.gateway.emitNewVulnerability(organizationId, {
            id: vuln.id,
            title: vuln.title,
            severity: vuln.severity,
            scanId,
          });
        }
      }
    }

    // Update scan counters
    await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        criticalCount: { increment: criticalCount },
        highCount: { increment: highCount },
        mediumCount: { increment: mediumCount },
        lowCount: { increment: lowCount },
        infoCount: { increment: infoCount },
        findings: { increment: findings.length },
      },
    });
  }

  private async checkScanCompletion(scanId: string, organizationId: string): Promise<void> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        scannerJobs: { select: { status: true } },
      },
    });
    if (!scan) return;

    const allJobs = scan.scannerJobs;
    const completedJobs = allJobs.filter((j) => j.status === 'COMPLETED' || j.status === 'FAILED');

    if (completedJobs.length < allJobs.length) {
      return; // Still running
    }

    const hasFailures = allJobs.some((j) => j.status === 'FAILED');
    const status = hasFailures
      ? completedJobs.length === allJobs.length
        ? ScanStatus.PARTIAL
        : ScanStatus.COMPLETED
      : ScanStatus.COMPLETED;

    const now = new Date();
    const durationSeconds = scan.startedAt
      ? Math.floor((now.getTime() - scan.startedAt.getTime()) / 1000)
      : undefined;

    await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        status,
        completedAt: now,
        progress: 100,
        durationSeconds,
      },
    });

    // Emit completion via WebSocket
    this.gateway.emitScanCompleted(organizationId, scanId, {
      status,
      findings: scan.findings,
      criticalCount: scan.criticalCount,
      highCount: scan.highCount,
    });

    // Send notifications
    if (scan.criticalCount > 0) {
      void this.notifications.sendNotification({
        type: NOTIFICATION_EVENTS.SCAN_COMPLETED,
        severity: 'CRITICAL',
        organizationId,
        title: 'Scan Completed — Critical Vulnerabilities Found',
        message: `Scan "${scan.name}" completed with ${scan.criticalCount} critical vulnerabilities requiring immediate attention.`,
        entityType: 'scan',
        entityId: scanId,
        actionUrl: `/scans/${scanId}`,
        data: { criticalCount: scan.criticalCount, highCount: scan.highCount },
      }).catch(() => undefined);
    }

    // Clear progress cache
    await this.redis.del(`scan:progress:${scanId}`);
    this.logger.info({ scanId, status, findings: scan.findings }, 'Scan completed');
  }

  private async handleJobFailure(result: ScanResultMessage): Promise<void> {
    await this.prisma.scannerJob.updateMany({
      where: { id: result.jobId },
      data: {
        status: ScanStatus.FAILED,
        completedAt: new Date(),
        errorMessage: result.errorMessage,
      },
    });

    await this.checkScanCompletion(result.scanId, result.organizationId);
  }

  private determineCategoryFromFinding(finding: {
    cveIds?: string[];
    cweIds?: string[];
    title?: string;
    description?: string;
  }): VulnerabilityCategory {
    const text = `${finding.title ?? ''} ${finding.description ?? ''} ${finding.cweIds?.join(' ') ?? ''}`.toLowerCase();

    if (text.includes('injection') || text.includes('sql') || text.includes('ldap')) return 'INJECTION';
    if (text.includes('xss') || text.includes('cross-site scripting')) return 'XSS';
    if (text.includes('csrf') || text.includes('cross-site request')) return 'CSRF';
    if (text.includes('ssrf') || text.includes('server-side request')) return 'SSRF';
    if (text.includes('auth') || text.includes('session') || text.includes('credential')) return 'BROKEN_AUTH';
    if (text.includes('crypto') || text.includes('cipher') || text.includes('ssl') || text.includes('tls')) return 'WEAK_CRYPTOGRAPHY';
    if (text.includes('secret') || text.includes('api key') || text.includes('password')) return 'HARDCODED_SECRETS';
    if (text.includes('misconfigur')) return 'MISCONFIGURATION';
    if (text.includes('path traversal') || text.includes('directory traversal')) return 'PATH_TRAVERSAL';
    if (text.includes('command') || text.includes('rce') || text.includes('exec')) return 'COMMAND_INJECTION';
    if (text.includes('privilege')) return 'PRIVILEGE_ESCALATION';
    if (text.includes('disclosure') || text.includes('information')) return 'INFORMATION_DISCLOSURE';

    return 'MISCONFIGURATION';
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkStuckScans(): Promise<void> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Mark stuck scans as failed
    await this.prisma.scan.updateMany({
      where: {
        status: { in: ['RUNNING', 'INITIALIZING'] },
        startedAt: { lt: twentyFourHoursAgo },
      },
      data: {
        status: ScanStatus.TIMEOUT,
        failedAt: new Date(),
        errorMessage: 'Scan timed out after 24 hours',
      },
    });
  }
}

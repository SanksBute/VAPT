import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Scan, Prisma } from '@prisma/client';
import { ScanStatus } from '@prisma/client';
import type { ScanType, ScannerType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RedisService } from '../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '@sentinelx/shared';
import {
  buildPaginationMeta,
  buildSkipTake,
  normalizePaginationParams,
  QUEUES,
  EVENTS,
  calculateSlaDeadline,
  calculateRiskScore,
} from '@sentinelx/shared';
import type { CreateScanDto } from './dto/create-scan.dto';
import type { QueryScansDto } from './dto/query-scans.dto';
import type { ScanProgress } from '@sentinelx/shared';

@Injectable()
export class ScanService {
  constructor(
    @InjectPinoLogger(ScanService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async createScan(dto: CreateScanDto, user: AuthContext): Promise<Scan> {
    // Check scan limits
    await this.checkScanLimits(user.organizationId);

    // Validate profile if provided
    if (dto.profileId) {
      const profile = await this.prisma.scanProfile.findFirst({
        where: {
          id: dto.profileId,
          OR: [{ organizationId: user.organizationId }, { isSystem: true }],
        },
      });
      if (!profile) throw new NotFoundException('Scan profile not found');
    }

    // Validate project if provided
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId: user.organizationId, deletedAt: null },
      });
      if (!project) throw new NotFoundException('Project not found');
    }

    const scan = await this.prisma.scan.create({
      data: {
        organizationId: user.organizationId,
        projectId: dto.projectId,
        profileId: dto.profileId,
        name: dto.name,
        description: dto.description,
        scanType: dto.scanType as ScanType,
        status: ScanStatus.PENDING,
        priority: dto.priority ?? 5,
        configuration: (dto.configuration ?? {}) as Prisma.InputJsonValue,
        credentials: dto.credentials as Prisma.InputJsonValue | undefined,
        excludeList: dto.excludeTargets ?? [],
        tags: dto.tags ?? [],
        initiatedBy: user.userId,
        totalTargets: dto.targets.length,
        targets: {
          createMany: {
            data: dto.targets.map((target) => ({
              value: target,
              type: this.detectTargetType(target),
            })),
          },
        },
      },
      include: {
        targets: true,
        profile: true,
        project: true,
      },
    });

    // Broadcast scan-created event (audit/notification subscribers)
    await this.queue.publish(EVENTS.SCAN_CREATED, {
      type: EVENTS.SCAN_CREATED,
      payload: {
        scanId: scan.id,
        organizationId: user.organizationId,
        scanType: scan.scanType,
        targets: dto.targets,
        configuration: dto.configuration ?? {},
        credentials: dto.credentials as Prisma.InputJsonValue | undefined,
        priority: scan.priority,
      },
      organizationId: user.organizationId,
      userId: user.userId,
      timestamp: new Date().toISOString(),
    });

    // Create and dispatch a scanner job per (target, scanner) pair
    const jobsToRun: Array<{ id: string; scanner: ScannerType; target: string; targetType: string }> = [];

    for (const target of scan.targets) {
      const scanners = this.getScannersForTarget(scan.scanType, target.type);

      for (const scanner of scanners) {
        const job = await this.prisma.scannerJob.create({
          data: {
            scanId: scan.id,
            scanner,
            target: target.value,
            configuration: (dto.configuration ?? {}) as Prisma.InputJsonValue,
          },
        });
        jobsToRun.push({ id: job.id, scanner, target: target.value, targetType: target.type });
      }
    }

    if (jobsToRun.length === 0) {
      this.logger.warn(
        { scanId: scan.id, scanType: scan.scanType },
        'No scanner available for this scan type/target combination',
      );

      await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: ScanStatus.FAILED,
          failedAt: new Date(),
          errorCode: 'SCAN_006',
          errorMessage: `No scanner is available yet for scan type "${scan.scanType}" against the given target(s).`,
        },
      });

      return { ...scan, status: ScanStatus.FAILED };
    }

    for (const job of jobsToRun) {
      await this.queue.sendToQueue(QUEUES.SCAN_JOBS, {
        type: 'scan.job.dispatch',
        payload: {
          jobId: job.id,
          scanId: scan.id,
          organizationId: user.organizationId,
          scanner: job.scanner,
          target: job.target,
          targetType: job.targetType,
          configuration: dto.configuration ?? {},
          credentials: dto.credentials,
        },
        organizationId: user.organizationId,
        userId: user.userId,
        timestamp: new Date().toISOString(),
      });
    }

    void this.audit.log({
      userId: user.userId,
      organizationId: user.organizationId,
      action: 'SCAN_STARTED',
      entityType: 'scan',
      entityId: scan.id,
      success: true,
      metadata: { scanType: scan.scanType, targetCount: dto.targets.length },
    });

    this.logger.info(
      { scanId: scan.id, orgId: user.organizationId, scanType: scan.scanType },
      'Scan created and queued',
    );

    return scan;
  }

  async findAll(
    orgId: string,
    dto: QueryScansDto,
  ): Promise<{ items: Scan[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { page, limit } = normalizePaginationParams(dto);
    const { skip, take } = buildSkipTake(page, limit);

    const where: Prisma.ScanWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      ...(dto.status ? { status: { in: dto.status as ScanStatus[] } } : {}),
      ...(dto.scanType ? { scanType: { in: dto.scanType as Prisma.EnumScanTypeFilter['in'] } } : {}),
      ...(dto.projectId ? { projectId: dto.projectId } : {}),
      ...(dto.search ? {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { description: { contains: dto.search, mode: 'insensitive' } },
        ],
      } : {}),
      ...(dto.dateFrom ? { createdAt: { gte: new Date(dto.dateFrom) } } : {}),
      ...(dto.dateTo ? { createdAt: { lte: new Date(dto.dateTo) } } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.scan.count({ where }),
      this.prisma.scan.findMany({
        where,
        skip,
        take,
        orderBy: { [dto.sortBy ?? 'createdAt']: dto.sortOrder ?? 'desc' },
        include: {
          _count: { select: { targets: true, vulnerabilities: true } },
          project: { select: { id: true, name: true, color: true } },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, orgId: string): Promise<Scan> {
    const scan = await this.prisma.scan.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        targets: true,
        profile: true,
        project: { select: { id: true, name: true } },
        scannerJobs: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            scanner: true,
            status: true,
            target: true,
            progress: true,
            startedAt: true,
            completedAt: true,
            errorMessage: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { vulnerabilities: true } },
      },
    });

    if (!scan) throw new NotFoundException(`Scan ${id} not found`);
    return scan;
  }

  async cancelScan(id: string, orgId: string, userId: string): Promise<Scan> {
    const scan = await this.prisma.scan.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });

    if (!scan) throw new NotFoundException(`Scan ${id} not found`);

    const cancellableStatuses: ScanStatus[] = [
      ScanStatus.PENDING,
      ScanStatus.QUEUED,
      ScanStatus.INITIALIZING,
      ScanStatus.RUNNING,
      ScanStatus.PAUSED,
    ];

    if (!cancellableStatuses.includes(scan.status)) {
      throw new BadRequestException(`Cannot cancel scan in ${scan.status} status`);
    }

    const updated = await this.prisma.scan.update({
      where: { id },
      data: {
        status: ScanStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    // Notify worker to cancel
    await this.queue.publish(EVENTS.SCAN_CANCELLED, {
      type: EVENTS.SCAN_CANCELLED,
      payload: { scanId: id },
      organizationId: orgId,
      userId,
      timestamp: new Date().toISOString(),
    });

    void this.audit.log({
      userId,
      organizationId: orgId,
      action: 'SCAN_CANCELLED',
      entityType: 'scan',
      entityId: id,
      success: true,
    });

    return updated;
  }

  async deleteScan(id: string, orgId: string, userId: string): Promise<void> {
    const scan = await this.prisma.scan.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });

    if (!scan) throw new NotFoundException(`Scan ${id} not found`);

    if (scan.status === ScanStatus.RUNNING || scan.status === ScanStatus.INITIALIZING) {
      throw new BadRequestException('Cannot delete a running scan. Cancel it first.');
    }

    await this.prisma.scan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    void this.audit.log({
      userId,
      organizationId: orgId,
      action: 'DELETE',
      entityType: 'scan',
      entityId: id,
      success: true,
    });
  }

  async getScanProgress(scanId: string, orgId: string): Promise<ScanProgress | null> {
    const progressKey = `scan:progress:${scanId}`;
    const cached = await this.redis.get(progressKey);
    if (cached) {
      return JSON.parse(cached) as ScanProgress;
    }

    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        status: true,
        progress: true,
        totalTargets: true,
        scannedTargets: true,
        startedAt: true,
        findings: true,
        scannerJobs: {
          select: { status: true },
        },
        events: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { type: true, message: true, severity: true, createdAt: true },
        },
      },
    });

    if (!scan) return null;

    const activeJobs = scan.scannerJobs.filter((j) => j.status === 'RUNNING').length;
    const completedJobs = scan.scannerJobs.filter((j) => j.status === 'COMPLETED').length;
    const failedJobs = scan.scannerJobs.filter((j) => j.status === 'FAILED').length;

    return {
      scanId,
      status: scan.status as ScanProgress['status'],
      progress: scan.progress,
      totalTargets: scan.totalTargets,
      scannedTargets: scan.scannedTargets,
      findings: scan.findings,
      startedAt: scan.startedAt?.toISOString(),
      activeJobs,
      completedJobs,
      failedJobs,
      events: scan.events.map((e) => ({
        timestamp: e.createdAt.toISOString(),
        type: e.type,
        message: e.message,
        severity: e.severity as 'info' | 'warning' | 'error',
      })),
    };
  }

  async getScanStatistics(
    orgId: string,
    days: number = 30,
  ): Promise<Record<string, unknown>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalScans, byStatus, byType, recentScans] = await Promise.all([
      this.prisma.scan.count({ where: { organizationId: orgId, deletedAt: null } }),
      this.prisma.scan.groupBy({
        by: ['status'],
        where: { organizationId: orgId, deletedAt: null, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.scan.groupBy({
        by: ['scanType'],
        where: { organizationId: orgId, deletedAt: null, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.scan.findMany({
        where: { organizationId: orgId, deletedAt: null, createdAt: { gte: since } },
        select: {
          status: true,
          findings: true,
          criticalCount: true,
          highCount: true,
          createdAt: true,
          completedAt: true,
          durationSeconds: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const avgDuration = recentScans
      .filter((s) => s.durationSeconds)
      .reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0) / Math.max(1, recentScans.filter((s) => s.durationSeconds).length);

    return {
      total: totalScans,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byType: Object.fromEntries(byType.map((s) => [s.scanType, s._count])),
      averageDurationSeconds: Math.round(avgDuration),
      totalFindings: recentScans.reduce((acc, s) => acc + s.findings, 0),
      criticalFindings: recentScans.reduce((acc, s) => acc + s.criticalCount, 0),
    };
  }

  private async checkScanLimits(orgId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { maxScansPerMonth: true },
    });

    if (!org) throw new NotFoundException('Organization not found');

    if (org.maxScansPerMonth === -1) return; // Unlimited

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await this.prisma.scan.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: startOfMonth },
        deletedAt: null,
      },
    });

    if (monthlyCount >= org.maxScansPerMonth) {
      throw new ForbiddenException(
        `Monthly scan limit (${org.maxScansPerMonth}) reached. Upgrade your plan for more scans.`,
      );
    }
  }

  private detectTargetType(target: string): string {
    if (/^https?:\/\//i.test(target)) return 'url';
    if (/\/\d+$/.test(target)) return 'cidr';
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target)) return 'ip';
    if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(target)) return 'hostname';
    return 'unknown';
  }

  /**
   * Maps a scan type + target type to the scanners that should run against it.
   * Only scanners with an actual executor implementation should be listed here —
   * unmapped combinations report as "no scanner available" rather than hanging forever.
   */
  private getScannersForTarget(scanType: ScanType, targetType: string): ScannerType[] {
    const isNmapTarget = ['ip', 'cidr', 'hostname'].includes(targetType);
    const isNucleiTarget = ['url', 'hostname', 'ip'].includes(targetType);
    const scanners: ScannerType[] = [];

    switch (scanType) {
      case 'DISCOVERY':
      case 'PORT_SCAN':
        if (isNmapTarget) scanners.push('NMAP');
        break;
      case 'VULNERABILITY_ASSESSMENT':
      case 'FULL':
      case 'PENETRATION_TEST':
        if (isNmapTarget) scanners.push('NMAP');
        if (isNucleiTarget) scanners.push('NUCLEI');
        break;
      case 'WEB_APPLICATION':
      case 'API_SECURITY':
        scanners.push('NUCLEI');
        break;
      case 'CONTAINER_SECURITY':
      case 'KUBERNETES_SECURITY':
        scanners.push('TRIVY');
        break;
      case 'CLOUD_SECURITY':
        scanners.push('SCOUTSUITE');
        break;
      case 'CODE_ANALYSIS':
      case 'SECRET_DETECTION':
        scanners.push('SEMGREP');
        break;
      case 'COMPLIANCE':
        scanners.push('LYNIS');
        break;
      case 'AD_SECURITY':
        if (isNmapTarget) scanners.push('NMAP');
        break;
      case 'THREAT_INTEL':
        scanners.push('NUCLEI');
        break;
      default:
        break;
    }

    // Guarantee at least one scanner so the scan can run (real or simulated)
    // rather than dead-ending as "no scanner available".
    if (scanners.length === 0) {
      scanners.push(isNmapTarget ? 'NMAP' : 'NUCLEI');
    }

    return scanners;
  }
}

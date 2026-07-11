import { Injectable, NotFoundException } from '@nestjs/common';
import type { Asset, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '@sentinelx/shared';
import { buildPaginationMeta, buildSkipTake, normalizePaginationParams, EVENTS } from '@sentinelx/shared';

@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
  ) {}

  async findAll(orgId: string, options: {
    page?: number; limit?: number; type?: string[]; status?: string[];
    criticality?: string[]; search?: string; projectId?: string;
    cloudProvider?: string; environment?: string; tag?: string;
    sortBy?: string; sortOrder?: 'asc' | 'desc';
  } = {}) {
    const { page, limit } = normalizePaginationParams(options);
    const { skip, take } = buildSkipTake(page, limit);

    const where: Prisma.AssetWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      ...(options.type?.length ? { type: { in: options.type as Asset['type'][] } } : {}),
      ...(options.status?.length ? { status: { in: options.status as Asset['status'][] } } : {}),
      ...(options.criticality?.length ? { criticality: { in: options.criticality as Asset['criticality'][] } } : {}),
      ...(options.cloudProvider ? { cloudProvider: options.cloudProvider as Asset['cloudProvider'] } : {}),
      ...(options.environment ? { environment: options.environment } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(options.tag ? { tags: { some: { tag: { name: options.tag } } } } : {}),
      ...(options.search ? {
        OR: [
          { name: { contains: options.search, mode: 'insensitive' } },
          { hostname: { contains: options.search, mode: 'insensitive' } },
          { identifier: { contains: options.search, mode: 'insensitive' } },
          { ipAddresses: { has: options.search } },
        ],
      } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where, skip, take,
        orderBy: { [options.sortBy ?? 'riskScore']: options.sortOrder ?? 'desc' },
        include: {
          tags: { include: { tag: true } },
          _count: { select: { vulnerabilities: true, ports_detail: true } },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, orgId: string): Promise<Asset> {
    const asset = await this.prisma.asset.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        ports_detail: { orderBy: { port: 'asc' } },
        certificates: true,
        technologies_detail: { orderBy: { name: 'asc' } },
        tags: { include: { tag: true } },
        vulnerabilities: {
          include: {
            vulnerability: {
              select: {
                id: true, title: true, severity: true, status: true,
                cvssV3Score: true, slaDeadline: true, slaBreached: true,
              },
            },
          },
          where: { vulnerability: { status: { notIn: ['RESOLVED', 'FALSE_POSITIVE'] } } },
          orderBy: { vulnerability: { riskScore: 'desc' } },
          take: 20,
        },
        history: { orderBy: { createdAt: 'desc' }, take: 10 },
        project: { select: { id: true, name: true } },
      },
    });

    if (!asset) throw new NotFoundException(`Asset ${id} not found`);
    return asset;
  }

  async create(orgId: string, data: Partial<Asset>, user: AuthContext): Promise<Asset> {
    const asset = await this.prisma.asset.create({
      data: {
        organizationId: orgId,
        name: data.name!,
        type: data.type!,
        identifier: data.identifier ?? data.name!,
        status: data.status ?? 'ACTIVE',
        criticality: data.criticality ?? 'MEDIUM',
        hostname: data.hostname,
        ipAddresses: data.ipAddresses ?? [],
        operatingSystem: data.operatingSystem,
        environment: data.environment,
        owner: data.owner,
        team: data.team,
        projectId: data.projectId,
        cloudProvider: data.cloudProvider,
        cloudRegion: data.cloudRegion,
        cloudAccountId: data.cloudAccountId,
        notes: data.notes,
        customFields: data.customFields ?? {},
      },
    });

    void this.audit.log({
      userId: user.userId,
      organizationId: orgId,
      action: 'CREATE',
      entityType: 'asset',
      entityId: asset.id,
      success: true,
    });

    return asset;
  }

  async update(id: string, orgId: string, data: Partial<Asset>, user: AuthContext): Promise<Asset> {
    const asset = await this.prisma.asset.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...(data as Prisma.AssetUpdateInput),
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    void this.audit.log({
      userId: user.userId,
      organizationId: orgId,
      action: 'UPDATE',
      entityType: 'asset',
      entityId: id,
      success: true,
    });

    return updated;
  }

  async delete(id: string, orgId: string, user: AuthContext): Promise<void> {
    const asset = await this.prisma.asset.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    await this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DECOMMISSIONED' },
    });

    void this.audit.log({
      userId: user.userId,
      organizationId: orgId,
      action: 'DELETE',
      entityType: 'asset',
      entityId: id,
      success: true,
    });
  }

  async getStatistics(orgId: string): Promise<Record<string, unknown>> {
    const [byType, byCriticality, byStatus, riskSummary, recentDiscoveries] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['type'], where: { organizationId: orgId, deletedAt: null }, _count: true }),
      this.prisma.asset.groupBy({ by: ['criticality'], where: { organizationId: orgId, deletedAt: null }, _count: true }),
      this.prisma.asset.groupBy({ by: ['status'], where: { organizationId: orgId, deletedAt: null }, _count: true }),
      this.prisma.asset.aggregate({
        where: { organizationId: orgId, deletedAt: null },
        _avg: { riskScore: true, exposureScore: true },
        _max: { riskScore: true },
        _count: true,
      }),
      this.prisma.asset.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          firstSeenAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      total: riskSummary._count,
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count])),
      byCriticality: Object.fromEntries(byCriticality.map((c) => [c.criticality, c._count])),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      averageRiskScore: riskSummary._avg.riskScore,
      maxRiskScore: riskSummary._max.riskScore,
      recentDiscoveries,
    };
  }

  async triggerDiscovery(orgId: string, targets: string[], user: AuthContext): Promise<void> {
    await this.queue.publish(EVENTS.ASSET_DISCOVERED, {
      type: EVENTS.ASSET_DISCOVERED,
      payload: { organizationId: orgId, targets, initiatedBy: user.userId },
      organizationId: orgId,
      userId: user.userId,
      timestamp: new Date().toISOString(),
    });
  }
}

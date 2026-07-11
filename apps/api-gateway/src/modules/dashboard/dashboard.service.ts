import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(orgId: string) {
    const [assets, vulns, scans, openTickets, riskScore] = await Promise.all([
      this.prisma.asset.count({ where: { organizationId: orgId, deletedAt: null } }),
      this.prisma.vulnerability.groupBy({ by: ['severity'], where: { organizationId: orgId, deletedAt: null, status: { notIn: ['RESOLVED', 'FALSE_POSITIVE'] } }, _count: true }),
      this.prisma.scan.findMany({ where: { organizationId: orgId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, status: true, scanType: true, findings: true, createdAt: true } }),
      this.prisma.ticket.count({ where: { organizationId: orgId, deletedAt: null, status: { notIn: ['RESOLVED', 'CLOSED', 'WONT_FIX'] } } }),
      this.prisma.asset.aggregate({ where: { organizationId: orgId, deletedAt: null }, _avg: { riskScore: true } }),
    ]);

    const vulnBySeverity = Object.fromEntries(vulns.map((v) => [v.severity, v._count]));

    return {
      assets: { total: assets },
      vulnerabilities: {
        critical: vulnBySeverity['CRITICAL'] ?? 0,
        high: vulnBySeverity['HIGH'] ?? 0,
        medium: vulnBySeverity['MEDIUM'] ?? 0,
        low: vulnBySeverity['LOW'] ?? 0,
        total: Object.values(vulnBySeverity).reduce((a, b) => a + b, 0),
      },
      recentScans: scans,
      openTickets,
      averageRiskScore: riskScore._avg.riskScore ?? 0,
    };
  }

  async getRiskTrend(orgId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.$queryRaw<Array<{ date: string; count: bigint; severity: string }>>`
      SELECT DATE("firstDetectedAt") as date, "severity", COUNT(*) as count
      FROM "vulnerabilities"
      WHERE "organizationId" = ${orgId}::uuid
      AND "firstDetectedAt" >= ${since}
      AND "deletedAt" IS NULL
      GROUP BY DATE("firstDetectedAt"), "severity"
      ORDER BY date ASC
    `;
  }

  async getTopRiskyAssets(orgId: string, limit: number = 10) {
    return this.prisma.asset.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { riskScore: 'desc' },
      take: limit,
      select: {
        id: true, name: true, type: true, criticality: true, riskScore: true,
        _count: { select: { vulnerabilities: true } },
      },
    });
  }

  async listDashboards(orgId: string, userId: string) {
    return this.prisma.dashboard.findMany({
      where: { organizationId: orgId, deletedAt: null, OR: [{ isShared: true }, { userId }] },
      orderBy: { isDefault: 'desc' },
    });
  }

  async createDashboard(orgId: string, userId: string, data: { name: string; widgets: unknown[] }) {
    return this.prisma.dashboard.create({
      data: { organizationId: orgId, userId, name: data.name, widgets: data.widgets as Prisma.InputJsonValue },
    });
  }
}

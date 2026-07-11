import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  async getRiskProfiles(orgId: string) {
    return this.prisma.riskProfile.findMany({ where: { organizationId: orgId, deletedAt: null } });
  }

  async getRiskItems(profileId: string, orgId: string) {
    return this.prisma.riskItem.findMany({
      where: { profileId, profile: { organizationId: orgId }, deletedAt: null },
      orderBy: { residualRisk: 'desc' },
    });
  }

  async getRiskSummary(orgId: string) {
    const [criticalVulns, slaBreached, exploitableVulns, highRiskAssets] = await Promise.all([
      this.prisma.vulnerability.count({ where: { organizationId: orgId, severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'FALSE_POSITIVE'] }, deletedAt: null } }),
      this.prisma.vulnerability.count({ where: { organizationId: orgId, slaBreached: true, status: { notIn: ['RESOLVED', 'FALSE_POSITIVE'] }, deletedAt: null } }),
      this.prisma.vulnerability.count({ where: { organizationId: orgId, exploitAvailable: true, status: { notIn: ['RESOLVED', 'FALSE_POSITIVE'] }, deletedAt: null } }),
      this.prisma.asset.count({ where: { organizationId: orgId, riskScore: { gte: 70 }, deletedAt: null } }),
    ]);

    const riskScore = Math.min(100, (criticalVulns * 3 + slaBreached * 2 + exploitableVulns * 2 + highRiskAssets) / 10);

    return {
      overallRiskScore: Math.round(riskScore),
      riskLevel: riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW',
      criticalVulnerabilities: criticalVulns,
      slaBreached,
      exploitableVulnerabilities: exploitableVulns,
      highRiskAssets,
    };
  }
}

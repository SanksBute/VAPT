import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { Organization, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '@sentinelx/shared';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findBySlug(slug: string): Promise<Organization> {
    const org = await this.prisma.organization.findUnique({ where: { slug, deletedAt: null } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async findById(id: string): Promise<Organization> {
    const org = await this.prisma.organization.findUnique({ where: { id, deletedAt: null } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, data: Partial<Organization>, user: AuthContext): Promise<Organization> {
    const org = await this.findById(id);
    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        name: data.name,
        displayName: data.displayName,
        logoUrl: data.logoUrl,
        timezone: data.timezone,
        settings: data.settings as Prisma.InputJsonValue,
        billingEmail: data.billingEmail,
        technicalEmail: data.technicalEmail,
        securityEmail: data.securityEmail,
        mfaRequired: data.mfaRequired,
        version: { increment: 1 },
      },
    });

    void this.audit.log({ userId: user.userId, organizationId: id, action: 'UPDATE', entityType: 'organization', entityId: id, success: true });
    return updated;
  }

  async getUsageMetrics(orgId: string) {
    const [users, assets, scansThisMonth, vulns] = await Promise.all([
      this.prisma.organizationMember.count({ where: { organizationId: orgId, deletedAt: null } }),
      this.prisma.asset.count({ where: { organizationId: orgId, deletedAt: null } }),
      this.prisma.scan.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          createdAt: { gte: new Date(new Date().setDate(1)) },
        },
      }),
      this.prisma.vulnerability.count({ where: { organizationId: orgId, deletedAt: null, status: 'OPEN' } }),
    ]);

    return { users, assets, scansThisMonth, openVulnerabilities: vulns };
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '@sentinelx/shared';

@Injectable()
export class IntegrationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findAll(orgId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, data: { name: string; type: string; provider: string; config?: Record<string, unknown> }, user: AuthContext) {
    const integration = await this.prisma.integration.create({
      data: {
        organizationId: orgId,
        name: data.name,
        type: data.type,
        provider: data.provider,
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        status: 'PENDING_SETUP',
      },
    });
    void this.audit.log({ userId: user.userId, organizationId: orgId, action: 'CREATE', entityType: 'integration', entityId: integration.id, success: true });
    return integration;
  }

  async delete(id: string, orgId: string, user: AuthContext) {
    await this.prisma.integration.update({ where: { id }, data: { deletedAt: new Date() } });
    void this.audit.log({ userId: user.userId, organizationId: orgId, action: 'DELETE', entityType: 'integration', entityId: id, success: true });
  }
}

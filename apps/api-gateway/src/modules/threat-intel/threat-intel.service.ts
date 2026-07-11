import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { buildPaginationMeta, buildSkipTake } from '@sentinelx/shared';

@Injectable()
export class ThreatIntelService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeeds(orgId: string) {
    return this.prisma.threatIntelFeed.findMany({
      where: { OR: [{ organizationId: orgId }, { isSystem: true }], isActive: true },
    });
  }

  async getIndicators(orgId: string, options: { type?: string; severity?: string; page?: number; limit?: number } = {}) {
    const take = options.limit ?? 25;
    const skip = ((options.page ?? 1) - 1) * take;
    const [total, items] = await Promise.all([
      this.prisma.threatIndicator.count({
        where: {
          feed: { OR: [{ organizationId: orgId }, { isSystem: true }] },
          expiresAt: { gt: new Date() },
          ...(options.type ? { type: options.type } : {}),
          ...(options.severity ? { severity: options.severity } : {}),
        },
      }),
      this.prisma.threatIndicator.findMany({
        where: {
          feed: { OR: [{ organizationId: orgId }, { isSystem: true }] },
          expiresAt: { gt: new Date() },
          ...(options.type ? { type: options.type } : {}),
          ...(options.severity ? { severity: options.severity } : {}),
        },
        skip, take,
        orderBy: { confidence: 'desc' },
        include: { feed: { select: { name: true, provider: true } } },
      }),
    ]);
    return { items, meta: buildPaginationMeta(total, options.page ?? 1, take) };
  }

  async searchIndicators(query: string) {
    return this.prisma.threatIndicator.findMany({
      where: {
        OR: [
          { value: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { malwareFamily: { contains: query, mode: 'insensitive' } },
        ],
        expiresAt: { gt: new Date() },
      },
      take: 20,
      orderBy: { confidence: 'desc' },
    });
  }
}

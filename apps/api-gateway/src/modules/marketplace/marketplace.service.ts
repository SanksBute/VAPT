import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlugins(options: { category?: string; search?: string; page?: number; limit?: number } = {}) {
    const take = options.limit ?? 24;
    const skip = ((options.page ?? 1) - 1) * take;
    const [total, items] = await Promise.all([
      this.prisma.plugin.count({ where: { status: 'ACTIVE', deletedAt: null, ...(options.category ? { category: options.category } : {}), ...(options.search ? { OR: [{ name: { contains: options.search, mode: 'insensitive' } }, { description: { contains: options.search, mode: 'insensitive' } }] } : {}) } }),
      this.prisma.plugin.findMany({ where: { status: 'ACTIVE', deletedAt: null, ...(options.category ? { category: options.category } : {}), ...(options.search ? { OR: [{ name: { contains: options.search, mode: 'insensitive' } }, { description: { contains: options.search, mode: 'insensitive' } }] } : {}) }, skip, take, orderBy: { downloads: 'desc' } }),
    ]);
    return { items, meta: { page: options.page ?? 1, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  async getPlugin(id: string) {
    return this.prisma.plugin.findFirst({ where: { id, status: 'ACTIVE', deletedAt: null } });
  }

  async installPlugin(pluginId: string, orgId: string, userId: string) {
    return this.prisma.pluginInstallation.upsert({
      where: { organizationId_pluginId: { organizationId: orgId, pluginId } },
      create: { organizationId: orgId, pluginId, version: '1.0.0', isActive: true, installedBy: userId },
      update: { isActive: true },
    });
  }

  async uninstallPlugin(pluginId: string, orgId: string) {
    await this.prisma.pluginInstallation.updateMany({ where: { pluginId, organizationId: orgId }, data: { isActive: false } });
  }

  async getInstalledPlugins(orgId: string) {
    return this.prisma.pluginInstallation.findMany({ where: { organizationId: orgId, isActive: true }, include: { plugin: true } });
  }
}

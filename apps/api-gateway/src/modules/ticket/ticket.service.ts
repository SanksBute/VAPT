import { Injectable, NotFoundException } from '@nestjs/common';
import type { Ticket, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '@sentinelx/shared';
import { buildPaginationMeta, buildSkipTake, normalizePaginationParams } from '@sentinelx/shared';

@Injectable()
export class TicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(orgId: string, data: {
    title: string; description: string; priority: string;
    assigneeId?: string; vulnerabilityIds?: string[];
  }, user: AuthContext): Promise<Ticket> {
    const ticketNumber = await this.generateTicketNumber(orgId);
    const slaHours = { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 240 };
    const priority = data.priority as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    const hours = slaHours[priority] ?? 240;
    const slaDeadline = new Date(Date.now() + hours * 60 * 60 * 1000);

    const ticket = await this.prisma.ticket.create({
      data: {
        organizationId: orgId,
        ticketNumber,
        title: data.title,
        description: data.description,
        priority: priority as Ticket['priority'],
        createdById: user.userId,
        assigneeId: data.assigneeId,
        slaDeadline,
        vulnerabilities: data.vulnerabilityIds?.length
          ? { createMany: { data: data.vulnerabilityIds.map((vulnerabilityId) => ({ vulnerabilityId })) } }
          : undefined,
      },
    });

    void this.audit.log({ userId: user.userId, organizationId: orgId, action: 'CREATE', entityType: 'ticket', entityId: ticket.id, success: true });
    return ticket;
  }

  async findAll(orgId: string, options: { page?: number; limit?: number; status?: string; assigneeId?: string; priority?: string } = {}) {
    const { page, limit } = normalizePaginationParams(options);
    const { skip, take } = buildSkipTake(page, limit);
    const where: Prisma.TicketWhereInput = {
      organizationId: orgId, deletedAt: null,
      ...(options.status ? { status: options.status as Ticket['status'] } : {}),
      ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
      ...(options.priority ? { priority: options.priority as Ticket['priority'] } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: {
          assignee: { select: { firstName: true, lastName: true, avatarUrl: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          _count: { select: { vulnerabilities: true, comments: true } },
        },
      }),
    ]);
    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, orgId: string): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        vulnerabilities: { include: { vulnerability: { select: { id: true, title: true, severity: true, status: true } } } },
        comments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'desc' }, take: 20 },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async update(id: string, orgId: string, data: Partial<{ status: string; priority: string; assigneeId: string }>, user: AuthContext): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, organizationId: orgId, deletedAt: null } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const updateData: Prisma.TicketUpdateInput = { version: { increment: 1 } };
    if (data.status) updateData.status = data.status as Ticket['status'];
    if (data.priority) updateData.priority = data.priority as Ticket['priority'];
    if (data.assigneeId !== undefined) updateData.assignee = data.assigneeId ? { connect: { id: data.assigneeId } } : { disconnect: true };
    if (data.status === 'RESOLVED') updateData.resolvedAt = new Date();
    if (data.status === 'CLOSED') updateData.closedAt = new Date();

    return this.prisma.ticket.update({ where: { id }, data: updateData });
  }

  private async generateTicketNumber(orgId: string): Promise<string> {
    const count = await this.prisma.ticket.count({ where: { organizationId: orgId } });
    const orgSlug = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true } });
    const prefix = orgSlug?.slug.substring(0, 4).toUpperCase() ?? 'TICK';
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
}

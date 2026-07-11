import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '@sentinelx/shared';
import type { PaginatedResult } from '@sentinelx/shared';
import { buildPaginationMeta, buildSkipTake, normalizePaginationParams } from '@sentinelx/shared';

export interface CreateAuditLogParams {
  organizationId?: string;
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  success?: boolean;
  errorMessage?: string;
  duration?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectPinoLogger(AuditService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async log(params: CreateAuditLogParams): Promise<void> {
    // Use fire-and-forget via queue for high-throughput audit logging
    try {
      await this.queue.sendToQueue(QUEUES.AUDIT_LOG, {
        type: 'audit.log',
        payload: params,
        organizationId: params.organizationId,
        userId: params.userId,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Fallback: direct DB write if queue is unavailable
      try {
        await this.prisma.auditLog.create({
          data: {
            organizationId: params.organizationId,
            userId: params.userId,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            changes: params.changes as Prisma.InputJsonValue | undefined,
            metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            sessionId: params.sessionId,
            requestId: params.requestId,
            success: params.success ?? true,
            errorMessage: params.errorMessage,
            duration: params.duration,
          },
        });
      } catch (dbErr) {
        this.logger.error({ err: dbErr, params }, 'Failed to write audit log');
      }
    }
  }

  async processAuditLogFromQueue(params: CreateAuditLogParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes as Prisma.InputJsonValue | undefined,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        sessionId: params.sessionId,
        requestId: params.requestId,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
        duration: params.duration,
      },
    });
  }

  async findAll(
    orgId: string,
    options: {
      page?: number;
      limit?: number;
      action?: AuditAction;
      userId?: string;
      entityType?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit } = normalizePaginationParams(options);
    const { skip, take } = buildSkipTake(page, limit);

    const where: Prisma.AuditLogWhereInput = {
      organizationId: orgId,
      ...(options.action ? { action: options.action } : {}),
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.entityType ? { entityType: options.entityType } : {}),
      ...(options.dateFrom || options.dateTo ? {
        createdAt: {
          ...(options.dateFrom ? { gte: options.dateFrom } : {}),
          ...(options.dateTo ? { lte: options.dateTo } : {}),
        },
      } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          userAgent: true,
          success: true,
          duration: true,
          createdAt: true,
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  }
}

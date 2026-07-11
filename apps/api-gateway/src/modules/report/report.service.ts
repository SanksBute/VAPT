import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Report, ReportType, ReportFormat, Prisma } from '@prisma/client';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AiAnalysisService } from '../ai/services/ai-analysis.service';
import type { AuthContext } from '@sentinelx/shared';
import { buildPaginationMeta, buildSkipTake, normalizePaginationParams, QUEUES } from '@sentinelx/shared';

export interface CreateReportDto {
  title: string;
  reportType: ReportType;
  format: ReportFormat;
  templateId?: string;
  scanIds?: string[];
  config?: Record<string, unknown>;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class ReportService {
  constructor(
    @InjectPinoLogger(ReportService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly aiAnalysis: AiAnalysisService,
  ) {}

  async create(dto: CreateReportDto, user: AuthContext): Promise<Report> {
    if (dto.scanIds?.length) {
      const scans = await this.prisma.scan.count({
        where: { id: { in: dto.scanIds }, organizationId: user.organizationId },
      });
      if (scans !== dto.scanIds.length) {
        throw new BadRequestException('One or more scan IDs are invalid');
      }
    }

    const report = await this.prisma.report.create({
      data: {
        organizationId: user.organizationId,
        generatedById: user.userId,
        title: dto.title,
        reportType: dto.reportType,
        format: dto.format,
        templateId: dto.templateId,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
        dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
        status: ReportStatus.GENERATING,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        scans: dto.scanIds?.length
          ? { createMany: { data: dto.scanIds.map((scanId) => ({ scanId })) } }
          : undefined,
      },
    });

    // Queue report generation
    await this.queue.sendToQueue(QUEUES.REPORT_GENERATION, {
      type: 'report.generate',
      payload: {
        reportId: report.id,
        organizationId: user.organizationId,
        reportType: dto.reportType,
        format: dto.format,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
        scanIds: dto.scanIds,
      },
      organizationId: user.organizationId,
      userId: user.userId,
      timestamp: new Date().toISOString(),
    });

    return report;
  }

  async findAll(orgId: string, options: { page?: number; limit?: number; reportType?: string; format?: string } = {}) {
    const { page, limit } = normalizePaginationParams(options);
    const { skip, take } = buildSkipTake(page, limit);

    const where = {
      organizationId: orgId,
      deletedAt: null as null,
      ...(options.reportType ? { reportType: options.reportType as ReportType } : {}),
      ...(options.format ? { format: options.format as ReportFormat } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, reportType: true, format: true, status: true,
          fileUrl: true, fileSize: true, pageCount: true, expiresAt: true,
          downloadCount: true, aiSummary: true, createdAt: true,
          generatedBy: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string, orgId: string): Promise<Report> {
    const report = await this.prisma.report.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async getDownloadUrl(id: string, orgId: string): Promise<{ url: string; expiresAt: Date }> {
    const report = await this.findOne(id, orgId);

    if (report.status !== ReportStatus.COMPLETED) {
      throw new BadRequestException('Report is not ready for download');
    }

    if (report.expiresAt && report.expiresAt < new Date()) {
      throw new BadRequestException('Report has expired');
    }

    // Increment download count
    await this.prisma.report.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    return {
      url: report.fileUrl ?? '',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min presigned URL
    };
  }

  async delete(id: string, orgId: string): Promise<void> {
    const report = await this.findOne(id, orgId);
    await this.prisma.report.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

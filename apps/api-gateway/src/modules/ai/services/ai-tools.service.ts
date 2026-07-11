import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { ScanStatus, ComplianceFramework, VulnerabilitySeverity, VulnerabilityStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>, orgId: string) => Promise<unknown>;
}

@Injectable()
export class AiToolsService {
  private readonly tools: Map<string, AITool> = new Map();

  constructor(
    @InjectPinoLogger(AiToolsService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
  ) {
    this.registerTools();
  }

  private registerTools(): void {
    this.tools.set('get_vulnerability_stats', {
      name: 'get_vulnerability_stats',
      description: 'Get vulnerability statistics for the organization including counts by severity, status, and trends',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to analyze (default: 30)' },
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'all'], description: 'Filter by severity' },
        },
      },
      execute: async (params, orgId) => {
        const days = (params['days'] as number | undefined) ?? 30;
        const since = new Date();
        since.setDate(since.getDate() - days);

        return this.prisma.vulnerability.groupBy({
          by: ['severity', 'status'],
          where: { organizationId: orgId, deletedAt: null, createdAt: { gte: since } },
          _count: true,
        });
      },
    });

    this.tools.set('get_asset_risk_summary', {
      name: 'get_asset_risk_summary',
      description: 'Get a risk summary of all assets including most critical assets',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of top risky assets to return (default: 10)' },
        },
      },
      execute: async (params, orgId) => {
        const limit = (params['limit'] as number | undefined) ?? 10;
        return this.prisma.asset.findMany({
          where: { organizationId: orgId, deletedAt: null },
          orderBy: { riskScore: 'desc' },
          take: limit,
          select: {
            name: true,
            type: true,
            criticality: true,
            riskScore: true,
            exposureScore: true,
            _count: { select: { vulnerabilities: true } },
          },
        });
      },
    });

    this.tools.set('get_recent_scans', {
      name: 'get_recent_scans',
      description: 'Get recent security scans and their results',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of recent scans to return (default: 5)' },
          status: { type: 'string', description: 'Filter by scan status' },
        },
      },
      execute: async (params, orgId) => {
        const limit = (params['limit'] as number | undefined) ?? 5;
        return this.prisma.scan.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            ...(params['status'] ? { status: params['status'] as ScanStatus } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            name: true,
            scanType: true,
            status: true,
            findings: true,
            criticalCount: true,
            highCount: true,
            completedAt: true,
          },
        });
      },
    });

    this.tools.set('get_compliance_status', {
      name: 'get_compliance_status',
      description: 'Get compliance status across all active frameworks',
      parameters: {
        type: 'object',
        properties: {
          framework: { type: 'string', description: 'Specific compliance framework to check' },
        },
      },
      execute: async (params, orgId) => {
        return this.prisma.complianceProfile.findMany({
          where: {
            organizationId: orgId,
            isActive: true,
            ...(params['framework'] ? { framework: params['framework'] as ComplianceFramework } : {}),
          },
          include: {
            assessments: {
              orderBy: { assessmentDate: 'desc' },
              take: 1,
              select: {
                overallScore: true,
                overallStatus: true,
                assessmentDate: true,
              },
            },
          },
        });
      },
    });

    this.tools.set('search_vulnerabilities', {
      name: 'search_vulnerabilities',
      description: 'Search for vulnerabilities by CVE, title, or description',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (CVE ID, title, or keyword)' },
          severity: { type: 'string', description: 'Filter by severity' },
          status: { type: 'string', description: 'Filter by status' },
          limit: { type: 'number', description: 'Maximum results to return' },
        },
        required: ['query'],
      },
      execute: async (params, orgId) => {
        const query = params['query'] as string;
        const limit = (params['limit'] as number | undefined) ?? 10;

        return this.prisma.vulnerability.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            ...(params['severity'] ? { severity: params['severity'] as VulnerabilitySeverity } : {}),
            ...(params['status'] ? { status: params['status'] as VulnerabilityStatus } : {}),
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { cveIds: { has: query } },
            ],
          },
          take: limit,
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
            cvssV3Score: true,
            cveIds: true,
            firstDetectedAt: true,
            slaDeadline: true,
            slaBreached: true,
          },
        });
      },
    });

    this.tools.set('get_threat_indicators', {
      name: 'get_threat_indicators',
      description: 'Get relevant threat intelligence indicators matching organization assets',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'IOC type (ip, domain, url, hash)' },
          severity: { type: 'string', description: 'Minimum severity level' },
          limit: { type: 'number', description: 'Maximum results' },
        },
      },
      execute: async (params, orgId) => {
        return this.prisma.threatIndicator.findMany({
          where: {
            feed: { organizationId: orgId },
            ...(params['type'] ? { type: params['type'] as string } : {}),
            expiresAt: { gt: new Date() },
          },
          take: (params['limit'] as number | undefined) ?? 20,
          orderBy: { confidence: 'desc' },
          select: {
            type: true,
            value: true,
            severity: true,
            confidence: true,
            description: true,
            mitreId: true,
            firstSeenAt: true,
          },
        });
      },
    });
  }

  getTools(): AITool[] {
    return [...this.tools.values()];
  }

  getToolDefinitions(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return [...this.tools.values()].map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async executeTool(name: string, params: Record<string, unknown>, orgId: string): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool '${name}' not found`);
    return tool.execute(params, orgId);
  }
}

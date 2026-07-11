import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AiAnalysisService } from '../ai/services/ai-analysis.service';
import type { AuthContext } from '@sentinelx/shared';
import { buildPaginationMeta, buildSkipTake, normalizePaginationParams } from '@sentinelx/shared';
import type { ComplianceProfile } from '@prisma/client';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly aiAnalysis: AiAnalysisService,
  ) {}

  async getProfiles(orgId: string) {
    return this.prisma.complianceProfile.findMany({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
      include: {
        _count: { select: { controls: true, assessments: true } },
        assessments: {
          orderBy: { assessmentDate: 'desc' },
          take: 1,
          select: { overallScore: true, overallStatus: true, assessmentDate: true },
        },
      },
    });
  }

  async getProfile(id: string, orgId: string): Promise<ComplianceProfile> {
    const profile = await this.prisma.complianceProfile.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        controls: { orderBy: { controlId: 'asc' } },
        assessments: {
          orderBy: { assessmentDate: 'desc' },
          take: 5,
          select: { id: true, overallScore: true, overallStatus: true, assessmentDate: true, status: true },
        },
      },
    });
    if (!profile) throw new NotFoundException('Compliance profile not found');
    return profile;
  }

  async getAssessment(assessmentId: string, orgId: string) {
    const assessment = await this.prisma.complianceAssessment.findFirst({
      where: {
        id: assessmentId,
        profile: { organizationId: orgId },
        deletedAt: null,
      },
      include: {
        profile: { select: { framework: true, name: true } },
        results: {
          include: { control: true },
          orderBy: { control: { controlId: 'asc' } },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async createAssessment(
    profileId: string,
    orgId: string,
    user: AuthContext,
  ) {
    const profile = await this.getProfile(profileId, orgId);

    const assessment = await this.prisma.complianceAssessment.create({
      data: {
        profileId,
        name: `${profile.framework} Assessment ${new Date().toLocaleDateString()}`,
        assessmentDate: new Date(),
        status: 'in_progress',
        assessorId: user.userId,
      },
    });

    void this.audit.log({
      userId: user.userId,
      organizationId: orgId,
      action: 'CREATE',
      entityType: 'compliance_assessment',
      entityId: assessment.id,
      success: true,
    });

    return assessment;
  }

  async getComplianceSummary(orgId: string) {
    const profiles = await this.prisma.complianceProfile.findMany({
      where: { organizationId: orgId, isActive: true, deletedAt: null },
      include: {
        assessments: {
          orderBy: { assessmentDate: 'desc' },
          take: 1,
          select: { overallScore: true, overallStatus: true, assessmentDate: true },
        },
      },
    });

    return profiles.map((p) => ({
      framework: p.framework,
      name: p.name,
      latestScore: p.assessments[0]?.overallScore ?? null,
      latestStatus: p.assessments[0]?.overallStatus ?? 'UNDER_REVIEW',
      lastAssessed: p.assessments[0]?.assessmentDate ?? null,
    }));
  }

  async generateAiGapAnalysis(assessmentId: string, orgId: string): Promise<string> {
    return this.aiAnalysis.generateComplianceGapAnalysis(assessmentId, orgId);
  }
}

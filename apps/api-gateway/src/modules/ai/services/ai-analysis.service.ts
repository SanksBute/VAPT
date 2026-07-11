import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../database/prisma.service';
import { AiProviderService } from './ai-provider.service';
import type { VulnerabilityAnalysis } from '@sentinelx/shared';

@Injectable()
export class AiAnalysisService {
  constructor(
    @InjectPinoLogger(AiAnalysisService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly providerService: AiProviderService,
  ) {}

  async analyzeVulnerability(
    vulnerabilityId: string,
    organizationId: string,
  ): Promise<VulnerabilityAnalysis> {
    const vuln = await this.prisma.vulnerability.findFirst({
      where: { id: vulnerabilityId, organizationId },
      include: {
        assets: {
          include: {
            asset: {
              select: {
                name: true,
                type: true,
                environment: true,
                criticality: true,
                technologies_detail: { take: 5 },
              },
            },
          },
          take: 5,
        },
      },
    });

    if (!vuln) throw new Error('Vulnerability not found');

    const template = await this.prisma.aIPromptTemplate.findUnique({
      where: { name: 'vulnerability_analysis' },
    });

    if (!template) throw new Error('Vulnerability analysis prompt template not found');

    const prompt = this.fillTemplate(template.template, {
      title: vuln.title,
      cveIds: vuln.cveIds.join(', ') || 'N/A',
      cvssScore: vuln.cvssV3Score?.toString() ?? 'N/A',
      cvssVector: vuln.cvssV3Vector ?? 'N/A',
      category: vuln.category,
      affectedComponent: vuln.affectedComponent ?? 'Unknown',
      description: vuln.description,
      assetType: vuln.assets[0]?.asset?.type ?? 'Unknown',
      environment: vuln.assets[0]?.asset?.environment ?? 'Unknown',
      criticality: vuln.assets[0]?.asset?.criticality ?? 'Unknown',
    });

    const providers = this.providerService.getAvailableProviders();
    const provider = providers[0] ?? 'OPENAI';

    const result = await this.providerService.complete({
      provider,
      model: provider === 'ANTHROPIC' ? 'claude-sonnet-4-5' : 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are an expert cybersecurity analyst. Always respond with valid JSON.',
      temperature: 0.1,
      maxTokens: 4096,
      responseFormat: { type: 'json_object' },
    });

    // Update vulnerability with AI analysis
    await this.prisma.vulnerability.update({
      where: { id: vulnerabilityId },
      data: {
        aiSummary: result.content.substring(0, 2000),
        aiRemediation: 'See full AI analysis',
      },
    });

    try {
      return JSON.parse(result.content) as VulnerabilityAnalysis;
    } catch {
      return {
        technicalAnalysis: result.content,
        businessImpact: 'Analysis generated — see technical analysis for details',
        exploitationLikelihood: 'MEDIUM',
        attackScenarios: [],
        immediateActions: [],
        longTermRemediation: [],
        verificationSteps: [],
        relatedVulnerabilities: [],
        mitreAttackMapping: [],
        complianceImpact: [],
        aiConfidence: 0.7,
      };
    }
  }

  async generateScanSummary(scanId: string, organizationId: string): Promise<string> {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, organizationId },
      include: {
        vulnerabilities: {
          where: { severity: { in: ['CRITICAL', 'HIGH'] } },
          take: 10,
          select: {
            title: true,
            severity: true,
            category: true,
            cvssV3Score: true,
            exploitAvailable: true,
          },
        },
      },
    });

    if (!scan) throw new Error('Scan not found');

    const template = await this.prisma.aIPromptTemplate.findUnique({
      where: { name: 'scan_summary' },
    });

    if (!template) throw new Error('Scan summary template not found');

    const topVulns = scan.vulnerabilities.map((v) =>
      `- ${v.severity}: ${v.title} (CVSS: ${v.cvssV3Score ?? 'N/A'}, Exploit: ${v.exploitAvailable ? 'Yes' : 'No'})`,
    ).join('\n');

    const prompt = this.fillTemplate(template.template, {
      scanType: scan.scanType,
      target: scan.name,
      duration: scan.durationSeconds ? `${Math.floor(scan.durationSeconds / 60)} minutes` : 'Unknown',
      date: scan.completedAt?.toISOString() ?? new Date().toISOString(),
      criticalCount: String(scan.criticalCount),
      highCount: String(scan.highCount),
      mediumCount: String(scan.mediumCount),
      lowCount: String(scan.lowCount),
      infoCount: String(scan.infoCount),
      topVulnerabilities: topVulns || 'No critical/high vulnerabilities found',
      assetSummary: `Total targets: ${scan.totalTargets}, Scanned: ${scan.scannedTargets}`,
    });

    const providers = this.providerService.getAvailableProviders();
    const provider = providers[0] ?? 'OPENAI';

    const result = await this.providerService.complete({
      provider,
      model: provider === 'ANTHROPIC' ? 'claude-sonnet-4-5' : 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are an expert cybersecurity consultant preparing executive reports. Be concise, clear, and business-focused.',
      temperature: 0.3,
      maxTokens: 2048,
    });

    // Update scan with AI summary
    await this.prisma.scan.update({
      where: { id: scanId },
      data: { metadata: { aiSummary: result.content.substring(0, 5000) } },
    });

    return result.content;
  }

  async generateComplianceGapAnalysis(
    assessmentId: string,
    organizationId: string,
  ): Promise<string> {
    const assessment = await this.prisma.complianceAssessment.findFirst({
      where: { id: assessmentId },
      include: {
        profile: { select: { framework: true, name: true } },
        results: {
          where: { status: 'NON_COMPLIANT' },
          include: { control: { select: { controlId: true, title: true, requirement: true } } },
          take: 20,
        },
      },
    });

    if (!assessment) throw new Error('Assessment not found');

    const gapItems = assessment.results.map((r) =>
      `Control ${r.control.controlId}: ${r.control.title} — ${r.control.requirement?.substring(0, 100)}`,
    ).join('\n');

    const template = await this.prisma.aIPromptTemplate.findUnique({
      where: { name: 'compliance_gap_analysis' },
    });

    const prompt = template
      ? this.fillTemplate(template.template, {
          framework: assessment.profile.framework,
          organizationName: 'Organization',
          assessmentDate: assessment.assessmentDate.toISOString(),
          controlResults: gapItems || 'No non-compliant controls found',
          vulnerabilities: 'See vulnerability management module',
          existingControls: 'Review current security controls',
        })
      : `Analyze compliance gaps for ${assessment.profile.framework}: ${gapItems}`;

    const providers = this.providerService.getAvailableProviders();
    const provider = providers[0] ?? 'OPENAI';

    const result = await this.providerService.complete({
      provider,
      model: provider === 'ANTHROPIC' ? 'claude-sonnet-4-5' : 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      maxTokens: 4096,
    });

    return result.content;
  }

  private fillTemplate(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}

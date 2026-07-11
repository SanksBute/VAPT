import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ComplianceService } from './compliance.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Compliance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'compliance', version: '1' })
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  @ApiOperation({ summary: 'Get compliance summary across all frameworks', operationId: 'getComplianceSummary' })
  getComplianceSummary(@CurrentUser() user: AuthContext) {
    return this.complianceService.getComplianceSummary(user.organizationId);
  }

  @Get('profiles')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  @ApiOperation({ summary: 'List compliance profiles', operationId: 'listComplianceProfiles' })
  listProfiles(@CurrentUser() user: AuthContext) {
    return this.complianceService.getProfiles(user.organizationId);
  }

  @Get('profiles/:id')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  @ApiOperation({ summary: 'Get compliance profile with controls', operationId: 'getComplianceProfile' })
  getProfile(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.complianceService.getProfile(id, user.organizationId);
  }

  @Post('profiles/:id/assess')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_ASSESS)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start compliance assessment', operationId: 'startAssessment' })
  startAssessment(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.complianceService.createAssessment(id, user.organizationId, user);
  }

  @Get('assessments/:id')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  @ApiOperation({ summary: 'Get assessment results', operationId: 'getAssessment' })
  getAssessment(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.complianceService.getAssessment(id, user.organizationId);
  }

  @Post('assessments/:id/ai-analysis')
  @RequirePermissions(PERMISSIONS.COMPLIANCE_VIEW)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI gap analysis for assessment', operationId: 'getAiGapAnalysis' })
  async getAiAnalysis(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    const analysis = await this.complianceService.generateAiGapAnalysis(id, user.organizationId);
    return { analysis };
  }
}

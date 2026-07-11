import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditAction } from '../../decorators/audit-action.decorator';
import { ReportService } from './report.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.REPORTS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @AuditAction('CREATE', 'report')
  @ApiOperation({ summary: 'Generate a new report', operationId: 'createReport' })
  async createReport(@Body() body: Parameters<ReportService['create']>[0], @CurrentUser() user: AuthContext) {
    return this.reportService.create(body, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'List reports', operationId: 'listReports' })
  async listReports(@CurrentUser() user: AuthContext, @Query() query: Record<string, unknown>) {
    return this.reportService.findAll(user.organizationId, query as Parameters<ReportService['findAll']>[1]);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Get report details', operationId: 'getReport' })
  async getReport(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.reportService.findOne(id, user.organizationId);
  }

  @Get(':id/download')
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @ApiOperation({ summary: 'Get report download URL', operationId: 'getReportDownloadUrl' })
  async getDownloadUrl(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.reportService.getDownloadUrl(id, user.organizationId);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.REPORTS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction('DELETE', 'report')
  @ApiOperation({ summary: 'Delete report', operationId: 'deleteReport' })
  async deleteReport(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    await this.reportService.delete(id, user.organizationId);
  }
}

import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import type { AuthContext } from '@sentinelx/shared';

@ApiTags('Dashboards')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'dashboards', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get security overview dashboard data', operationId: 'getOverview' })
  getOverview(@CurrentUser() user: AuthContext) { return this.dashboardService.getOverview(user.organizationId); }

  @Get('risk-trend')
  @ApiOperation({ summary: 'Get risk trend over time', operationId: 'getRiskTrend' })
  getRiskTrend(@CurrentUser() user: AuthContext, @Query('days') days?: number) {
    return this.dashboardService.getRiskTrend(user.organizationId, days ?? 30);
  }

  @Get('top-risky-assets')
  @ApiOperation({ summary: 'Get top risky assets', operationId: 'getTopRiskyAssets' })
  getTopRiskyAssets(@CurrentUser() user: AuthContext, @Query('limit') limit?: number) {
    return this.dashboardService.getTopRiskyAssets(user.organizationId, limit ?? 10);
  }

  @Get()
  @ApiOperation({ summary: 'List dashboards', operationId: 'listDashboards' })
  listDashboards(@CurrentUser() user: AuthContext) {
    return this.dashboardService.listDashboards(user.organizationId, user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create dashboard', operationId: 'createDashboard' })
  createDashboard(@Body() body: { name: string; widgets: unknown[] }, @CurrentUser() user: AuthContext) {
    return this.dashboardService.createDashboard(user.organizationId, user.userId, body);
  }
}

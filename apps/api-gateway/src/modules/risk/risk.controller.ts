import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RiskService } from './risk.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Risk Management')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'risk', version: '1' })
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  @ApiOperation({ summary: 'Get organization risk summary', operationId: 'getRiskSummary' })
  getRiskSummary(@CurrentUser() user: AuthContext) { return this.riskService.getRiskSummary(user.organizationId); }

  @Get('profiles')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  @ApiOperation({ summary: 'List risk profiles', operationId: 'listRiskProfiles' })
  getRiskProfiles(@CurrentUser() user: AuthContext) { return this.riskService.getRiskProfiles(user.organizationId); }

  @Get('profiles/:id/items')
  @RequirePermissions(PERMISSIONS.RISK_VIEW)
  @ApiOperation({ summary: 'Get risk items for profile', operationId: 'getRiskItems' })
  getRiskItems(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.riskService.getRiskItems(id, user.organizationId);
  }
}

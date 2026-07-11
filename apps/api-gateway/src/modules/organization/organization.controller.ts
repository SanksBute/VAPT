import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrganizationService } from './organization.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'organization', version: '1' })
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'Get organization details', operationId: 'getOrganization' })
  getOrganization(@CurrentUser() user: AuthContext) {
    return this.orgService.findById(user.organizationId);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.ORG_UPDATE)
  @ApiOperation({ summary: 'Update organization', operationId: 'updateOrganization' })
  updateOrganization(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthContext) {
    return this.orgService.update(user.organizationId, body as Parameters<OrganizationService['update']>[1], user);
  }

  @Get('usage')
  @RequirePermissions(PERMISSIONS.ORG_VIEW)
  @ApiOperation({ summary: 'Get usage metrics', operationId: 'getUsageMetrics' })
  getUsageMetrics(@CurrentUser() user: AuthContext) {
    return this.orgService.getUsageMetrics(user.organizationId);
  }
}

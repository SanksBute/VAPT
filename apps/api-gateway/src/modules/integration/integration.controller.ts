import { Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IntegrationService } from './integration.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Integrations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'integrations', version: '1' })
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_VIEW)
  @ApiOperation({ summary: 'List integrations', operationId: 'listIntegrations' })
  findAll(@CurrentUser() user: AuthContext) { return this.integrationService.findAll(user.organizationId); }

  @Post()
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create integration', operationId: 'createIntegration' })
  create(@Body() body: Parameters<IntegrationService['create']>[1], @CurrentUser() user: AuthContext) {
    return this.integrationService.create(user.organizationId, body, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.INTEGRATIONS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete integration', operationId: 'deleteIntegration' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    await this.integrationService.delete(id, user.organizationId, user);
  }
}

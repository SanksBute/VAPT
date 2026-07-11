import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditAction } from '../../decorators/audit-action.decorator';
import { AssetService } from './asset.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Assets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'assets', version: '1' })
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'List assets', operationId: 'listAssets' })
  async listAssets(@CurrentUser() user: AuthContext, @Query() query: Record<string, unknown>) {
    return this.assetService.findAll(user.organizationId, query as Parameters<AssetService['findAll']>[1]);
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Get asset statistics', operationId: 'getAssetStatistics' })
  async getStatistics(@CurrentUser() user: AuthContext) {
    return this.assetService.getStatistics(user.organizationId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_VIEW)
  @ApiOperation({ summary: 'Get asset details', operationId: 'getAsset' })
  async getAsset(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.assetService.findOne(id, user.organizationId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSETS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @AuditAction('CREATE', 'asset')
  @ApiOperation({ summary: 'Create asset', operationId: 'createAsset' })
  async createAsset(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthContext) {
    return this.assetService.create(user.organizationId, body as Parameters<AssetService['create']>[1], user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_UPDATE)
  @AuditAction('UPDATE', 'asset')
  @ApiOperation({ summary: 'Update asset', operationId: 'updateAsset' })
  async updateAsset(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthContext,
  ) {
    return this.assetService.update(id, user.organizationId, body as Parameters<AssetService['update']>[2], user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ASSETS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction('DELETE', 'asset')
  @ApiOperation({ summary: 'Delete asset', operationId: 'deleteAsset' })
  async deleteAsset(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    await this.assetService.delete(id, user.organizationId, user);
  }

  @Post('discover')
  @RequirePermissions(PERMISSIONS.ASSETS_CREATE)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger asset discovery', operationId: 'triggerDiscovery' })
  async triggerDiscovery(@Body('targets') targets: string[], @CurrentUser() user: AuthContext) {
    await this.assetService.triggerDiscovery(user.organizationId, targets, user);
    return { message: 'Asset discovery triggered' };
  }
}

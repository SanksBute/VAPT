import { Controller, Get, Post, Delete, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';
import type { AuthContext } from '@sentinelx/shared';

@ApiTags('Marketplace')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'marketplace', version: '1' })
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('plugins')
  @ApiOperation({ summary: 'List marketplace plugins', operationId: 'listPlugins' })
  listPlugins(@Query() query: { category?: string; search?: string; page?: number; limit?: number }) {
    return this.marketplaceService.listPlugins(query);
  }

  @Get('plugins/:id')
  @ApiOperation({ summary: 'Get plugin details', operationId: 'getPlugin' })
  getPlugin(@Param('id') id: string) { return this.marketplaceService.getPlugin(id); }

  @Post('plugins/:id/install')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Install plugin', operationId: 'installPlugin' })
  install(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.marketplaceService.installPlugin(id, user.organizationId, user.userId);
  }

  @Delete('plugins/:id/uninstall')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Uninstall plugin', operationId: 'uninstallPlugin' })
  async uninstall(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    await this.marketplaceService.uninstallPlugin(id, user.organizationId);
  }

  @Get('installed')
  @ApiOperation({ summary: 'List installed plugins', operationId: 'listInstalledPlugins' })
  listInstalled(@CurrentUser() user: AuthContext) {
    return this.marketplaceService.getInstalledPlugins(user.organizationId);
  }
}

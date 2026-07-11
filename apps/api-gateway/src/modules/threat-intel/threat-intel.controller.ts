import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThreatIntelService } from './threat-intel.service';
import type { AuthContext } from '@sentinelx/shared';

@ApiTags('Threat Intelligence')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'threat-intel', version: '1' })
export class ThreatIntelController {
  constructor(private readonly threatIntelService: ThreatIntelService) {}

  @Get('feeds')
  @ApiOperation({ summary: 'List threat intel feeds', operationId: 'listThreatIntelFeeds' })
  getFeeds(@CurrentUser() user: AuthContext) { return this.threatIntelService.getFeeds(user.organizationId); }

  @Get('indicators')
  @ApiOperation({ summary: 'List threat indicators', operationId: 'listThreatIndicators' })
  getIndicators(@CurrentUser() user: AuthContext, @Query() query: Parameters<ThreatIntelService['getIndicators']>[1]) {
    return this.threatIntelService.getIndicators(user.organizationId, query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search threat indicators', operationId: 'searchThreatIndicators' })
  searchIndicators(@Query('q') query: string) { return this.threatIntelService.searchIndicators(query ?? ''); }
}

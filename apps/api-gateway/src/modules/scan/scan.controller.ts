import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditAction } from '../../decorators/audit-action.decorator';
import { ScanService } from './scan.service';
import { CreateScanDto } from './dto/create-scan.dto';
import { QueryScansDto } from './dto/query-scans.dto';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Scans')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'scans', version: '1' })
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SCANS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @AuditAction('SCAN_STARTED', 'scan')
  @ApiOperation({ summary: 'Create and queue a new security scan', operationId: 'createScan' })
  @ApiResponse({ status: 201, description: 'Scan created and queued successfully' })
  @ApiResponse({ status: 403, description: 'Monthly scan limit exceeded or insufficient permissions' })
  async createScan(
    @Body() dto: CreateScanDto,
    @CurrentUser() user: AuthContext,
  ) {
    return this.scanService.createScan(dto, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SCANS_VIEW)
  @ApiOperation({ summary: 'List all scans for organization', operationId: 'listScans' })
  async listScans(
    @CurrentUser() user: AuthContext,
    @Query() query: QueryScansDto,
  ) {
    return this.scanService.findAll(user.organizationId, query);
  }

  @Get('statistics')
  @RequirePermissions(PERMISSIONS.SCANS_VIEW)
  @ApiOperation({ summary: 'Get scan statistics', operationId: 'getScanStatistics' })
  async getScanStatistics(
    @CurrentUser() user: AuthContext,
    @Query('days') days?: number,
  ) {
    return this.scanService.getScanStatistics(user.organizationId, days ?? 30);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SCANS_VIEW)
  @ApiOperation({ summary: 'Get scan details', operationId: 'getScan' })
  @ApiParam({ name: 'id', description: 'Scan UUID' })
  async getScan(
    @Param('id') id: string,
    @CurrentUser() user: AuthContext,
  ) {
    return this.scanService.findOne(id, user.organizationId);
  }

  @Get(':id/progress')
  @RequirePermissions(PERMISSIONS.SCANS_VIEW)
  @ApiOperation({ summary: 'Get real-time scan progress', operationId: 'getScanProgress' })
  async getScanProgress(
    @Param('id') id: string,
    @CurrentUser() user: AuthContext,
  ) {
    return this.scanService.getScanProgress(id, user.organizationId);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.SCANS_CANCEL)
  @HttpCode(HttpStatus.OK)
  @AuditAction('SCAN_CANCELLED', 'scan')
  @ApiOperation({ summary: 'Cancel a running scan', operationId: 'cancelScan' })
  async cancelScan(
    @Param('id') id: string,
    @CurrentUser() user: AuthContext,
  ) {
    return this.scanService.cancelScan(id, user.organizationId, user.userId);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SCANS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction('DELETE', 'scan')
  @ApiOperation({ summary: 'Delete a scan', operationId: 'deleteScan' })
  async deleteScan(
    @Param('id') id: string,
    @CurrentUser() user: AuthContext,
  ) {
    await this.scanService.deleteScan(id, user.organizationId, user.userId);
  }
}

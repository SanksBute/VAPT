import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditAction } from '../../decorators/audit-action.decorator';
import { TicketService } from './ticket.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Tickets')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'tickets', version: '1' })
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TICKETS_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @AuditAction('CREATE', 'ticket')
  @ApiOperation({ summary: 'Create a remediation ticket', operationId: 'createTicket' })
  create(@Body() body: Parameters<TicketService['create']>[1], @CurrentUser() user: AuthContext) {
    return this.ticketService.create(user.organizationId, body, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TICKETS_VIEW)
  @ApiOperation({ summary: 'List tickets', operationId: 'listTickets' })
  findAll(@CurrentUser() user: AuthContext, @Query() query: Parameters<TicketService['findAll']>[1]) {
    return this.ticketService.findAll(user.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TICKETS_VIEW)
  @ApiOperation({ summary: 'Get ticket details', operationId: 'getTicket' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    return this.ticketService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TICKETS_UPDATE)
  @AuditAction('UPDATE', 'ticket')
  @ApiOperation({ summary: 'Update ticket', operationId: 'updateTicket' })
  update(@Param('id') id: string, @Body() body: Parameters<TicketService['update']>[2], @CurrentUser() user: AuthContext) {
    return this.ticketService.update(id, user.organizationId, body, user);
  }
}

import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationService } from './notification.service';
import type { AuthContext } from '@sentinelx/shared';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications', operationId: 'listNotifications' })
  async list(
    @CurrentUser() user: AuthContext,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.list(user.userId, user.organizationId, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count', operationId: 'getUnreadCount' })
  async getUnreadCount(@CurrentUser() user: AuthContext) {
    const count = await this.notificationService.getUnreadCount(user.userId, user.organizationId);
    return { count };
  }

  @Post('mark-read')
  @ApiOperation({ summary: 'Mark notifications as read', operationId: 'markNotificationsRead' })
  async markAsRead(
    @CurrentUser() user: AuthContext,
    @Body('ids') ids: string[],
  ) {
    await this.notificationService.markAsRead(ids, user.userId);
    return { message: 'Notifications marked as read' };
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read', operationId: 'markAllNotificationsRead' })
  async markAllAsRead(@CurrentUser() user: AuthContext) {
    await this.notificationService.markAllAsRead(user.userId, user.organizationId);
    return { message: 'All notifications marked as read' };
  }
}

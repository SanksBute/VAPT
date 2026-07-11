import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserService } from './user.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile', operationId: 'getProfile' })
  getProfile(@CurrentUser() user: AuthContext) { return this.userService.getProfile(user.userId); }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile', operationId: 'updateProfile' })
  updateProfile(@Body() body: Record<string, unknown>, @CurrentUser() user: AuthContext) {
    return this.userService.updateProfile(user.userId, body as Parameters<UserService['updateProfile']>[1]);
  }

  @Get('members')
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  @ApiOperation({ summary: 'List organization members', operationId: 'listMembers' })
  listMembers(@CurrentUser() user: AuthContext, @Query() query: Parameters<UserService['findAll']>[1]) {
    return this.userService.findAll(user.organizationId, query);
  }

  @Post('invite')
  @RequirePermissions(PERMISSIONS.USERS_INVITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite user to organization', operationId: 'inviteMember' })
  invite(@Body() body: { email: string; role: string }, @CurrentUser() user: AuthContext) {
    return this.userService.inviteMember(user.organizationId, body.email, body.role, user);
  }

  @Patch('members/:id/role')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE_ROLE)
  @ApiOperation({ summary: 'Update member role', operationId: 'updateMemberRole' })
  updateRole(@Param('id') id: string, @Body('role') role: string, @CurrentUser() user: AuthContext) {
    return this.userService.updateMemberRole(user.organizationId, id, role, user);
  }

  @Delete('members/:id')
  @RequirePermissions(PERMISSIONS.USERS_REMOVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from organization', operationId: 'removeMember' })
  async removeMember(@Param('id') id: string, @CurrentUser() user: AuthContext) {
    await this.userService.removeMember(user.organizationId, id, user);
  }
}

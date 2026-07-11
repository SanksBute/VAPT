import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  Delete,
  UseGuards,
  Request,
  Response,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { AuthContext } from '@sentinelx/shared';
import { AuthService } from './auth.service';
import { MfaService } from './services/mfa.service';
import { TokenService } from './services/token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PublicRoute } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuditAction } from '../../decorators/audit-action.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EnableMfaDto } from './dto/enable-mfa.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('register')
  @PublicRoute()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account', operationId: 'register' })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    return this.authService.register(dto);
  }

  @Post('login')
  @PublicRoute()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @AuditAction('LOGIN', 'user')
  @ApiOperation({ summary: 'Authenticate user and receive JWT tokens', operationId: 'login' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked or suspended' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<unknown> {
    const result = await this.authService.login(dto, ip, userAgent);

    if ('mfaRequired' in result) {
      return result;
    }

    // Set httpOnly cookie for refresh token
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/v1/auth',
    });

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @AuditAction('LOGOUT', 'user')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and invalidate session', operationId: 'logout' })
  async logout(
    @CurrentUser() user: AuthContext,
    @Request() req: ExpressRequest & { token?: string },
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.sessionId, req.token ?? '');
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @PublicRoute()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token', operationId: 'refreshToken' })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Request() req: ExpressRequest & { cookies?: { refresh_token?: string } },
    @Ip() ip: string,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<unknown> {
    const refreshToken =
      req.cookies?.['refresh_token'] ??
      (req.headers['x-refresh-token'] as string | undefined) ?? '';

    const tokens = await this.authService.refreshToken(refreshToken, ip);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: tokens.tokenType,
    };
  }

  @Get('verify-email')
  @PublicRoute()
  @ApiOperation({ summary: 'Verify email address', operationId: 'verifyEmail' })
  async verifyEmail(@Query('token') token: string): Promise<{ message: string }> {
    return this.authService.verifyEmail(token);
  }

  @Post('forgot-password')
  @PublicRoute()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email', operationId: 'forgotPassword' })
  async forgotPassword(@Body('email') email: string): Promise<{ message: string }> {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  @PublicRoute()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @AuditAction('PASSWORD_RESET', 'user')
  @ApiOperation({ summary: 'Reset password using token', operationId: 'resetPassword' })
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(token, newPassword);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @AuditAction('PASSWORD_CHANGED', 'user')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password for authenticated user', operationId: 'changePassword' })
  async changePassword(
    @CurrentUser() user: AuthContext,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.tokenService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
    return { message: 'Password changed successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user info', operationId: 'getMe' })
  async getMe(@CurrentUser() user: AuthContext): Promise<AuthContext> {
    return user;
  }

  // ─── MFA ────────────────────────────────────────────────────────

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @AuditAction('MFA_ENABLED', 'user')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Enable MFA for user account', operationId: 'enableMfa' })
  async enableMfa(
    @CurrentUser() user: AuthContext,
    @Body() dto: EnableMfaDto,
  ): Promise<{ qrCode?: string; secret?: string; backupCodes?: string[]; message: string }> {
    return this.mfaService.enableMfa(user.userId, dto.method, dto.phoneNumber);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify and activate MFA setup', operationId: 'verifyMfa' })
  async verifyMfaSetup(
    @CurrentUser() user: AuthContext,
    @Body() dto: VerifyMfaDto,
  ): Promise<{ message: string }> {
    await this.mfaService.verifyAndActivateMfa(user.userId, dto.code);
    return { message: 'MFA enabled successfully' };
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @AuditAction('MFA_DISABLED', 'user')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable MFA for user account', operationId: 'disableMfa' })
  async disableMfa(
    @CurrentUser() user: AuthContext,
    @Body('code') code: string,
    @Body('password') password: string,
  ): Promise<{ message: string }> {
    await this.mfaService.disableMfa(user.userId, code, password);
    return { message: 'MFA disabled successfully' };
  }

  @Get('mfa/backup-codes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Regenerate MFA backup codes', operationId: 'regenerateBackupCodes' })
  async regenerateBackupCodes(@CurrentUser() user: AuthContext): Promise<{ backupCodes: string[] }> {
    const codes = await this.mfaService.regenerateBackupCodes(user.userId);
    return { backupCodes: codes };
  }

  // ─── API Keys ────────────────────────────────────────────────────

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @AuditAction('API_KEY_CREATED', 'api_key')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create API key', operationId: 'createApiKey' })
  async createApiKey(
    @CurrentUser() user: AuthContext,
    @Body() dto: CreateApiKeyDto,
  ): Promise<{ apiKey: string; id: string; prefix: string }> {
    return this.tokenService.createApiKey(user.userId, user.organizationId, dto);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List API keys', operationId: 'listApiKeys' })
  async listApiKeys(@CurrentUser() user: AuthContext): Promise<unknown[]> {
    return this.tokenService.listApiKeys(user.userId, user.organizationId);
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @AuditAction('API_KEY_REVOKED', 'api_key')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke API key', operationId: 'revokeApiKey' })
  async revokeApiKey(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.tokenService.revokeApiKey(id, user.userId, user.organizationId);
    return { message: 'API key revoked successfully' };
  }

  // ─── Sessions ────────────────────────────────────────────────────

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active sessions', operationId: 'listSessions' })
  async listSessions(@CurrentUser() user: AuthContext): Promise<unknown[]> {
    return this.tokenService.listActiveSessions(user.userId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a specific session', operationId: 'revokeSession' })
  async revokeSession(
    @CurrentUser() user: AuthContext,
    @Param('id') sessionId: string,
  ): Promise<{ message: string }> {
    await this.tokenService.revokeSession(sessionId, user.userId);
    return { message: 'Session revoked successfully' };
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke all sessions except current', operationId: 'revokeAllSessions' })
  async revokeAllSessions(
    @CurrentUser() user: AuthContext,
    @Request() req: ExpressRequest & { sessionId?: string },
  ): Promise<{ message: string }> {
    await this.tokenService.revokeAllSessionsExcept(user.userId, user.sessionId);
    return { message: 'All other sessions revoked successfully' };
  }
}

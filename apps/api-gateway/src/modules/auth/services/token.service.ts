import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import type { JwtPayload, AuthTokens } from '@sentinelx/shared';
import type { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { maskSensitiveValue } from '@sentinelx/shared';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TokenService {
  private readonly ACCESS_TOKEN_EXPIRY: number;
  private readonly REFRESH_TOKEN_EXPIRY: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
    this.REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds
  }

  async generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti' | 'type'>): Promise<AuthTokens> {
    const jti = randomUUID();

    const accessPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'access',
      jti,
    };

    const refreshPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      ...payload,
      type: 'refresh',
      jti: randomUUID(),
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      tokenType: 'Bearer',
    };
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  generateSecureToken(bytes: number = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  generateSecureId(): string {
    return randomUUID();
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createApiKey(
    userId: string,
    organizationId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: string; id: string; prefix: string }> {
    const rawKey = `sx_${this.generateSecureToken(24)}`;
    const prefix = rawKey.substring(0, 10);
    const keyHash = this.hashToken(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        organizationId,
        name: dto.name,
        keyHash,
        keyPrefix: prefix,
        scopes: dto.scopes ?? [],
        allowedIps: dto.allowedIps ?? [],
        expiresAt: dto.expiresAt,
        rateLimitRpm: dto.rateLimitRpm ?? 100,
      },
    });

    return {
      apiKey: rawKey,
      id: apiKey.id,
      prefix,
    };
  }

  async listApiKeys(userId: string, organizationId: string): Promise<unknown[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId, organizationId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        allowedIps: true,
        lastUsedAt: true,
        expiresAt: true,
        usageCount: true,
        rateLimitRpm: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      ...k,
      maskedKey: `${k.keyPrefix}${'*'.repeat(20)}`,
    }));
  }

  async revokeApiKey(id: string, userId: string, organizationId: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: { id, userId, organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listActiveSessions(userId: string): Promise<unknown[]> {
    return this.prisma.userSession.findMany({
      where: { userId, isActive: true, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceInfo: true,
        geolocation: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async revokeAllSessionsExcept(userId: string, currentSessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        isActive: true,
      },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new Error('Password not set for this account');
    }

    const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new Error('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordChangedAt: new Date() },
    });

    // Revoke all sessions to force re-login
    await this.prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });
  }
}

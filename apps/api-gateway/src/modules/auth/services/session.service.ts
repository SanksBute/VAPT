import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TokenService } from './token.service';

interface CreateSessionParams {
  id: string;
  userId: string;
  tokenHash: string;
  refreshTokenHash: string;
  ipAddress: string;
  userAgent?: string;
  deviceInfo: Record<string, unknown>;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async createSession(params: CreateSessionParams): Promise<void> {
    await this.prisma.userSession.create({
      data: {
        id: params.id,
        userId: params.userId,
        tokenHash: params.tokenHash,
        refreshTokenHash: params.refreshTokenHash,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        deviceInfo: params.deviceInfo as Prisma.InputJsonValue,
        isActive: true,
        expiresAt: params.expiresAt,
        lastSeenAt: new Date(),
      },
    });
  }

  async validateRefreshToken(
    refreshToken: string,
  ): Promise<{ id: string; userId: string } | null> {
    const tokenHash = this.tokenService.hashToken(refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      select: { id: true, userId: true, isActive: true, expiresAt: true, revokedAt: true },
    });

    if (
      !session ||
      !session.isActive ||
      session.revokedAt ||
      session.expiresAt < new Date()
    ) {
      return null;
    }

    return { id: session.id, userId: session.userId };
  }

  async rotateRefreshToken(sessionId: string, newRefreshToken: string): Promise<void> {
    const newHash = this.tokenService.hashToken(newRefreshToken);
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: newHash,
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async revokeSession(sessionId: string, _tokenHash: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async updateLastSeen(sessionId: string): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    }).catch(() => undefined);
  }

  async cleanExpiredSessions(): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: { expiresAt: { lt: new Date() }, isActive: true },
      data: { isActive: false },
    });
    return result.count;
  }
}

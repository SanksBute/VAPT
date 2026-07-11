import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload, AuthContext } from '@sentinelx/shared';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ROLE_PERMISSIONS } from '@sentinelx/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      issuer: 'sentinelx',
      audience: 'sentinelx-api',
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthContext> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if session is still active (cached check via Redis)
    const sessionRevoked = await this.redis.get(`session:revoked:${payload.sessionId}`);
    if (sessionRevoked) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // Verify user exists and is active (use cache to reduce DB load)
    const cacheKey = `user:auth:${payload.sub}`;
    const cached = await this.redis.get(cacheKey);

    let user: { status: string; deletedAt: Date | null } | null = null;

    if (cached) {
      user = JSON.parse(cached) as { status: string; deletedAt: Date | null };
    } else {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { status: true, deletedAt: true },
      });

      if (user) {
        await this.redis.set(cacheKey, JSON.stringify(user), 300); // Cache for 5 minutes
      }
    }

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or suspended');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      organizationId: payload.orgId ?? '',
      role: payload.role ?? 'VIEWER',
      permissions: payload.permissions ?? ROLE_PERMISSIONS[payload.role ?? 'VIEWER'] ?? [],
      sessionId: payload.sessionId,
      ipAddress: 'extracted-from-request',
    };
  }
}

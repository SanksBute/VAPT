import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { OAuthProfile } from '@sentinelx/shared';
import * as crypto from 'crypto';

@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findOrCreateUser(profile: OAuthProfile): Promise<string> {
    // Check if OAuth account exists
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: { select: { id: true, status: true } } },
    });

    if (existingOAuth) {
      if (existingOAuth.user.status !== 'ACTIVE') {
        throw new Error('Account is not active');
      }
      return existingOAuth.userId;
    }

    // Check if user with same email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true, status: true },
    });

    if (existingUser) {
      // Link OAuth account to existing user
      await this.prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          profile: profile.rawProfile as Prisma.InputJsonValue,
        },
      });

      if (existingUser.status !== 'ACTIVE') {
        throw new Error('Account is not active');
      }

      return existingUser.id;
    }

    // Create new user with OAuth account
    const newUser = await this.prisma.user.create({
      data: {
        email: profile.email,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        firstName: profile.firstName ?? 'User',
        lastName: profile.lastName ?? '',
        avatarUrl: profile.avatarUrl,
        status: 'ACTIVE',
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
            profile: profile.rawProfile as Prisma.InputJsonValue,
          },
        },
      },
    });

    return newUser.id;
  }

  generateStateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async buildGoogleAuthUrl(redirectUri: string, state: string): Promise<string> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) throw new Error('Google OAuth not configured');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async buildGithubAuthUrl(redirectUri: string, state: string): Promise<string> {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    if (!clientId) throw new Error('GitHub OAuth not configured');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'user:email',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
}

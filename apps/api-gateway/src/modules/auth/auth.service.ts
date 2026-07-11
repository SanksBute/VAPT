import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { User } from '@prisma/client';
import { UserStatus } from '@prisma/client';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@sentinelx/shared';
import type { AuthTokens, AuthContext, LoginRequest } from '@sentinelx/shared';
import { ROLE_PERMISSIONS } from '@sentinelx/shared';
import { PrismaService } from '../database/prisma.service';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { MfaService } from './services/mfa.service';
import { SessionService } from './services/session.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly mfaService: MfaService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const validated = registerSchema.parse(dto);

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: validated.email },
      select: { id: true, deletedAt: true },
    });

    if (existingUser && !existingUser.deletedAt) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(validated.password);
    const verificationToken = this.tokenService.generateSecureToken();
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: validated.email,
          passwordHash,
          firstName: validated.firstName,
          lastName: validated.lastName,
          displayName: `${validated.firstName} ${validated.lastName}`,
          timezone: validated.timezone,
          locale: validated.locale,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifications: {
            create: {
              token: verificationToken,
              expiresAt: verificationExpiry,
            },
          },
        },
      });

      // Create organization if provided
      if (validated.organizationName) {
        const slug = await this.generateOrgSlug(validated.organizationName, tx);
        const starterPlan = await tx.subscriptionPlan.findFirst({
          where: { name: 'starter', isActive: true },
        });

        const org = await tx.organization.create({
          data: {
            slug,
            name: validated.organizationName,
            status: 'TRIAL',
            tier: 'STARTER',
            timezone: validated.timezone,
          },
        });

        await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: newUser.id,
            role: 'ORG_OWNER',
            isOwner: true,
          },
        });

        if (starterPlan) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + starterPlan.trialDays);

          await tx.subscription.create({
            data: {
              organizationId: org.id,
              planId: starterPlan.id,
              status: 'TRIALING',
              billingInterval: 'MONTHLY',
              currentPeriodStart: new Date(),
              currentPeriodEnd: trialEnd,
              trialStart: new Date(),
              trialEnd,
            },
          });
        }
      } else if (validated.invitationToken) {
        // Handle invitation-based registration
        await this.processInvitation(validated.invitationToken, newUser.id, tx);
      }

      return newUser;
    });

    // Send verification email (non-blocking)
    void this.notificationService
      .sendEmailVerification(user.email, verificationToken, user.firstName)
      .catch((err: unknown) => this.logger.error({ err }, 'Failed to send verification email'));

    void this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      entityType: 'user',
      entityId: user.id,
      success: true,
    });

    return { message: 'Account created successfully. Please verify your email.' };
  }

  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<AuthTokens | { mfaRequired: true; challengeToken: string; method: string }> {
    const validated = loginSchema.parse(dto);

    const user = await this.prisma.user.findUnique({
      where: { email: validated.email },
      include: {
        mfaMethods: { where: { isVerified: true, isPrimary: true, deletedAt: null } },
        organizations: {
          include: { organization: true },
          where: { deletedAt: null },
          take: 1,
        },
      },
    });

    if (!user || !user.passwordHash) {
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'User not found',
        metadata: { email: validated.email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account status
    await this.checkAccountStatus(user);

    // Verify password
    const passwordValid = await this.passwordService.verify(validated.password, user.passwordHash);

    if (!passwordValid) {
      await this.handleFailedLogin(user.id, ipAddress);
      await this.auditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'Invalid password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login count
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    // MFA check
    const hasMfa = user.mfaMethods.length > 0 && user.mfaEnabled;
    const orgRequiresMfa = user.organizations[0]?.organization.mfaRequired ?? false;

    if ((hasMfa || orgRequiresMfa) && !validated.mfaCode) {
      const primaryMfa = user.mfaMethods[0];
      const challengeToken = await this.mfaService.createChallenge(
        user.id,
        primaryMfa?.method ?? 'EMAIL',
        validated.email,
      );

      return {
        mfaRequired: true,
        challengeToken,
        method: primaryMfa?.method ?? 'EMAIL',
      };
    }

    // Verify MFA if provided
    if (validated.mfaCode) {
      const mfaValid = await this.mfaService.verifyMfaCode(user.id, validated.mfaCode);
      if (!mfaValid) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    return this.createAuthSession(user, ipAddress, userAgent, validated.deviceInfo as Record<string, unknown> | undefined);
  }

  async logout(sessionId: string, tokenHash: string): Promise<void> {
    await this.sessionService.revokeSession(sessionId, tokenHash);
  }

  async refreshToken(
    refreshToken: string,
    ipAddress: string,
  ): Promise<AuthTokens> {
    const session = await this.sessionService.validateRefreshToken(refreshToken);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        organizations: {
          where: { deletedAt: null },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.checkAccountStatus(user);

    const orgMembership = user.organizations[0];
    const organizationId = orgMembership?.organizationId;
    const role = orgMembership?.role ?? 'VIEWER';
    const permissions = ROLE_PERMISSIONS[role] ?? [];

    const tokens = await this.tokenService.generateTokenPair({
      sub: user.id,
      email: user.email,
      orgId: organizationId,
      role,
      permissions,
      sessionId: session.id,
    });

    await this.sessionService.rotateRefreshToken(session.id, tokens.refreshToken);

    return tokens;
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const verification = await this.prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verification || verification.expiresAt < new Date() || verification.usedAt) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: verification.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: UserStatus.ACTIVE,
        },
      }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const validated = forgotPasswordSchema.parse({ email });

    const user = await this.prisma.user.findUnique({
      where: { email: validated.email },
      select: { id: true, email: true, firstName: true, status: true, deletedAt: true },
    });

    // Always return success to prevent email enumeration
    const successMessage = 'If an account with this email exists, you will receive a password reset link.';

    if (!user || user.deletedAt || user.status === UserStatus.SUSPENDED) {
      return { message: successMessage };
    }

    const resetToken = this.tokenService.generateSecureToken();
    const tokenHash = this.tokenService.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    void this.notificationService
      .sendPasswordReset(user.email, resetToken, user.firstName)
      .catch((err: unknown) => this.logger.error({ err }, 'Failed to send password reset email'));

    return { message: successMessage };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = this.tokenService.hashToken(token);

    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.expiresAt < new Date() || resetRecord.usedAt) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
    ]);

    // Revoke all active sessions
    await this.sessionService.revokeAllUserSessions(resetRecord.userId);

    void this.auditService.log({
      userId: resetRecord.userId,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: resetRecord.userId,
      success: true,
    });

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  async validateApiKey(keyHash: string): Promise<AuthContext | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: { select: { id: true, email: true, status: true, deletedAt: true } },
        organization: { select: { id: true, status: true } },
      },
    });

    if (
      !apiKey ||
      apiKey.revokedAt ||
      (apiKey.expiresAt && apiKey.expiresAt < new Date()) ||
      apiKey.user.status !== UserStatus.ACTIVE ||
      apiKey.user.deletedAt
    ) {
      return null;
    }

    if (apiKey.organization.status !== 'ACTIVE' && apiKey.organization.status !== 'TRIAL') {
      return null;
    }

    // Update usage stats (non-blocking)
    void this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: {
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
      })
      .catch(() => undefined);

    return {
      userId: apiKey.userId,
      email: apiKey.user.email,
      organizationId: apiKey.organizationId,
      role: 'API_USER',
      permissions: apiKey.scopes,
      sessionId: `api-key-${apiKey.id}`,
      ipAddress: 'unknown',
    };
  }

  private async createAuthSession(
    user: User,
    ipAddress: string,
    userAgent?: string,
    deviceInfo?: Record<string, unknown>,
  ): Promise<AuthTokens> {
    const orgMembership = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id, deletedAt: null },
      include: { organization: { select: { id: true, status: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    const organizationId = orgMembership?.organizationId;
    const role = orgMembership?.role ?? 'VIEWER';
    const permissions = ROLE_PERMISSIONS[role] ?? [];

    const sessionId = this.tokenService.generateSecureId();

    const tokens = await this.tokenService.generateTokenPair({
      sub: user.id,
      email: user.email,
      orgId: organizationId,
      role,
      permissions,
      sessionId,
    });

    await this.sessionService.createSession({
      id: sessionId,
      userId: user.id,
      tokenHash: this.tokenService.hashToken(tokens.accessToken),
      refreshTokenHash: this.tokenService.hashToken(tokens.refreshToken),
      ipAddress,
      userAgent,
      deviceInfo: deviceInfo ?? {},
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        loginCount: { increment: 1 },
      },
    });

    await this.auditService.log({
      userId: user.id,
      organizationId,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
      sessionId,
      success: true,
    });

    return tokens;
  }

  private async checkAccountStatus(user: Pick<User, 'id' | 'status' | 'emailVerified' | 'lockedUntil' | 'deletedAt'>): Promise<void> {
    if (user.deletedAt) {
      throw new UnauthorizedException('Account not found');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended. Contact support.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(
        `Account temporarily locked due to multiple failed login attempts. Try again in ${minutesLeft} minutes.`,
      );
    }

    if (!user.emailVerified && user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException('Please verify your email address before logging in.');
    }
  }

  private async handleFailedLogin(userId: string, ipAddress: string): Promise<void> {
    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION_MINUTES = 30;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginCount: true },
    });

    if (!user) return;

    const newCount = (user.failedLoginCount ?? 0) + 1;
    const lockedUntil =
      newCount >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: newCount,
        lockedUntil,
      },
    });
  }

  private async generateOrgSlug(name: string, tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0]): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    let slug = base;
    let counter = 1;

    while (true) {
      const existing = await tx.organization.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) return slug;
      slug = `${base}-${counter++}`;
    }
  }

  private async processInvitation(
    token: string,
    userId: string,
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
  ): Promise<void> {
    const invitation = await tx.invitation.findUnique({
      where: { token },
      select: { id: true, organizationId: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true },
    });

    if (!invitation || invitation.expiresAt < new Date() || invitation.acceptedAt || invitation.revokedAt) {
      return;
    }

    await tx.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
  }
}

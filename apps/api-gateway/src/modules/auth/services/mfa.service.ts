import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PasswordService } from './password.service';

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwordService: PasswordService,
  ) {}

  async enableMfa(
    userId: string,
    method: string,
    phoneNumber?: string,
  ): Promise<{ qrCode?: string; secret?: string; backupCodes?: string[]; message: string }> {
    if (method === 'TOTP') {
      const secret = authenticator.generateSecret(20);
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true },
      });

      const otpauth = authenticator.keyuri(user.email, 'SentinelX AI', secret);
      const qrCode = await qrcode.toDataURL(otpauth);

      // Store temp secret until verified
      await this.redis.set(`mfa:setup:${userId}`, secret, 600); // 10 min

      const backupCodes = this.generateBackupCodes();
      await this.redis.set(`mfa:backup:${userId}`, JSON.stringify(backupCodes), 600);

      return {
        qrCode,
        secret,
        backupCodes,
        message: 'Scan the QR code with your authenticator app and verify with a TOTP code',
      };
    }

    if (method === 'EMAIL') {
      const code = this.generateNumericCode();
      await this.redis.set(`mfa:email:${userId}`, code, 600);
      // In production: send via notification service
      return { message: 'Verification code sent to your email' };
    }

    if (method === 'SMS' && phoneNumber) {
      const code = this.generateNumericCode();
      await this.redis.set(`mfa:sms:${userId}`, code, 600);
      // In production: send via SMS service
      return { message: 'Verification code sent to your phone' };
    }

    throw new BadRequestException('Unsupported MFA method');
  }

  async verifyAndActivateMfa(userId: string, code: string): Promise<void> {
    const secret = await this.redis.get(`mfa:setup:${userId}`);
    if (!secret) {
      throw new BadRequestException('MFA setup session expired. Please restart setup.');
    }

    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const backupCodesJson = await this.redis.get(`mfa:backup:${userId}`);
    const backupCodes = backupCodesJson ? JSON.parse(backupCodesJson) as string[] : [];
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((c) => this.passwordService.hash(c)),
    );

    await this.prisma.$transaction([
      this.prisma.mfaDevice.create({
        data: {
          userId,
          method: 'TOTP',
          name: 'Authenticator App',
          secret,
          isVerified: true,
          isPrimary: true,
          backupCodes: hashedBackupCodes,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true, mfaEnforcedAt: new Date() },
      }),
    ]);

    await this.redis.del(`mfa:setup:${userId}`);
    await this.redis.del(`mfa:backup:${userId}`);
  }

  async disableMfa(userId: string, code: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, mfaEnabled: true },
    });

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('Cannot disable MFA for OAuth accounts');
    }

    const passwordValid = await this.passwordService.verify(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    const mfaValid = await this.verifyMfaCode(userId, code);
    if (!mfaValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prisma.$transaction([
      this.prisma.mfaDevice.updateMany({
        where: { userId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaEnforcedAt: null },
      }),
    ]);
  }

  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const device = await this.prisma.mfaDevice.findFirst({
      where: { userId, isPrimary: true, isVerified: true, deletedAt: null },
    });

    if (!device) return false;

    if (device.method === 'TOTP' && device.secret) {
      // Allow a window of ±1 step for clock skew
      return authenticator.verify({ token: code, secret: device.secret });
    }

    if (device.method === 'EMAIL' || device.method === 'SMS') {
      const redisKey = `mfa:${device.method.toLowerCase()}:${userId}`;
      const storedCode = await this.redis.get(redisKey);
      if (storedCode && storedCode === code) {
        await this.redis.del(redisKey);
        return true;
      }
      return false;
    }

    // Check backup codes
    if (device.backupCodes && Array.isArray(device.backupCodes)) {
      for (let i = 0; i < device.backupCodes.length; i++) {
        const hash = device.backupCodes[i] as string;
        const match = await this.passwordService.verify(code, hash);
        if (match) {
          // Remove used backup code
          const updatedCodes = [...device.backupCodes] as string[];
          updatedCodes.splice(i, 1);
          await this.prisma.mfaDevice.update({
            where: { id: device.id },
            data: { backupCodes: updatedCodes },
          });
          return true;
        }
      }
    }

    return false;
  }

  async createChallenge(userId: string, method: string, email: string): Promise<string> {
    const challenge = randomBytes(32).toString('hex');
    await this.redis.set(`mfa:challenge:${challenge}`, JSON.stringify({ userId, method }), 300);

    if (method === 'EMAIL') {
      const code = this.generateNumericCode();
      await this.redis.set(`mfa:email:${userId}`, code, 300);
      // In production: send code via email notification
    }

    return challenge;
  }

  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = this.generateBackupCodes();
    const hashedCodes = await Promise.all(backupCodes.map((c) => this.passwordService.hash(c)));

    await this.prisma.mfaDevice.updateMany({
      where: { userId, isPrimary: true, deletedAt: null },
      data: { backupCodes: hashedCodes },
    });

    return backupCodes;
  }

  private generateBackupCodes(count: number = 10): string[] {
    return Array.from({ length: count }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );
  }

  private generateNumericCode(digits: number = 6): string {
    const code = Math.floor(Math.random() * Math.pow(10, digits));
    return code.toString().padStart(digits, '0');
  }
}

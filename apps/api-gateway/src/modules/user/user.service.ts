import { Injectable, NotFoundException } from '@nestjs/common';
import type { User, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '@sentinelx/shared';
import { buildPaginationMeta, buildSkipTake, normalizePaginationParams } from '@sentinelx/shared';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findAll(orgId: string, options: { page?: number; limit?: number; search?: string; role?: string } = {}) {
    const { page, limit } = normalizePaginationParams(options);
    const { skip, take } = buildSkipTake(page, limit);

    const memberWhere: Prisma.OrganizationMemberWhereInput = {
      organizationId: orgId,
      deletedAt: null,
      ...(options.role ? { role: options.role as Prisma.EnumUserRoleFilter['equals'] } : {}),
    };

    const [total, members] = await Promise.all([
      this.prisma.organizationMember.count({ where: memberWhere }),
      this.prisma.organizationMember.findMany({
        where: memberWhere,
        skip, take,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, status: true, lastLoginAt: true, mfaEnabled: true },
          },
        },
      }),
    ]);

    return { items: members, meta: buildPaginationMeta(total, page, limit) };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, displayName: true,
        avatarUrl: true, phone: true, timezone: true, locale: true, theme: true,
        status: true, mfaEnabled: true, lastLoginAt: true, createdAt: true,
        organizations: {
          include: { organization: { select: { id: true, name: true, slug: true, logoUrl: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        phone: data.phone,
        timezone: data.timezone,
        locale: data.locale,
        theme: data.theme,
        preferences: data.preferences as Prisma.InputJsonValue,
      },
    });
  }

  async updateMemberRole(orgId: string, memberId: string, role: string, user: AuthContext) {
    return this.prisma.organizationMember.updateMany({
      where: { userId: memberId, organizationId: orgId },
      data: { role: role as Prisma.EnumUserRoleFilter['equals'] },
    });
  }

  async removeMember(orgId: string, memberId: string, user: AuthContext) {
    await this.prisma.organizationMember.updateMany({
      where: { userId: memberId, organizationId: orgId, isOwner: false },
      data: { deletedAt: new Date() },
    });
    void this.audit.log({ userId: user.userId, organizationId: orgId, action: 'MEMBER_REMOVED', entityType: 'user', entityId: memberId, success: true });
  }

  async inviteMember(orgId: string, email: string, role: string, user: AuthContext) {
    const { randomBytes } = await import('crypto');
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        email,
        role: role as Prisma.EnumUserRoleFilter['equals'],
        token,
        expiresAt,
        invitedById: user.userId,
      },
    });

    void this.audit.log({ userId: user.userId, organizationId: orgId, action: 'MEMBER_INVITED', entityType: 'invitation', entityId: invitation.id, success: true });
    return { token, expiresAt };
  }
}

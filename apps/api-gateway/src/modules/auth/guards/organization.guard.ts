import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthContext } from '@sentinelx/shared';
import { PrismaService } from '../../database/prisma.service';

export const ORGANIZATION_ACCESS_KEY = 'organization_access';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthContext; organization?: unknown }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Super admins bypass org checks
    if (user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_ADMIN') {
      return true;
    }

    const orgId = (request.params['orgId'] as string | undefined) ??
      (request.headers['x-organization-id'] as string | undefined) ??
      user.organizationId;

    if (!orgId) {
      throw new ForbiddenException('Organization context required');
    }

    if (orgId !== user.organizationId) {
      throw new ForbiddenException('Access denied to this organization');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId, deletedAt: null },
      select: { id: true, status: true, tier: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.status === 'SUSPENDED') {
      throw new ForbiddenException('Organization account is suspended');
    }

    request.organization = org;
    return true;
  }
}

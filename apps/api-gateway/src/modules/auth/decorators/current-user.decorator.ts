import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from '@sentinelx/shared';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthContext }>();
    if (!request.user) {
      throw new Error('CurrentUser decorator used outside authenticated route');
    }
    return request.user;
  },
);

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE = 'is_public_route';
export const PublicRoute = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_ROUTE, true);

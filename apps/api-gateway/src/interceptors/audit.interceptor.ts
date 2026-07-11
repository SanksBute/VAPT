import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { AUDIT_ACTION_METADATA } from '../decorators/audit-action.decorator';
import { AuditService } from '../modules/audit/audit.service';
import type { AuthContext } from '@sentinelx/shared';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const auditAction = Reflect.getMetadata(AUDIT_ACTION_METADATA, handler) as
      | { action: string; entityType?: string }
      | undefined;

    if (!auditAction) {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { user?: AuthContext }>();
    const response = ctx.getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          void this.auditService
            .log({
              organizationId: request.user?.organizationId,
              userId: request.user?.userId,
              action: auditAction.action as Parameters<typeof this.auditService.log>[0]['action'],
              entityType: auditAction.entityType,
              ipAddress: this.getClientIp(request),
              userAgent: request.headers['user-agent'],
              sessionId: request.user?.sessionId,
              requestId: response.getHeader('X-Request-ID') as string | undefined,
              success: true,
              duration,
            })
            .catch(() => undefined);
        },
        error: (err: unknown) => {
          const duration = Date.now() - startTime;
          void this.auditService
            .log({
              organizationId: request.user?.organizationId,
              userId: request.user?.userId,
              action: auditAction.action as Parameters<typeof this.auditService.log>[0]['action'],
              entityType: auditAction.entityType,
              ipAddress: this.getClientIp(request),
              userAgent: request.headers['user-agent'],
              sessionId: request.user?.sessionId,
              requestId: response.getHeader('X-Request-ID') as string | undefined,
              success: false,
              errorMessage:
                err instanceof Error ? err.message : 'Unknown error',
              duration,
            })
            .catch(() => undefined);
        },
      }),
    );
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? request.ip ?? 'unknown';
    }
    return request.ip ?? 'unknown';
  }
}

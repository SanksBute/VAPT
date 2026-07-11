import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import type { ApiResponse } from '@sentinelx/shared';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    response.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(
      map((data: unknown) => {
        // If the controller already returned a full ApiResponse, pass through
        if (
          data !== null &&
          typeof data === 'object' &&
          'success' in data &&
          'timestamp' in data
        ) {
          return data as ApiResponse<unknown>;
        }

        return {
          success: true,
          data,
          requestId,
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<unknown>;
      }),
    );
  }
}

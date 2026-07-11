import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import type { ZodError } from 'zod';
import type { ApiResponse } from '@sentinelx/shared';
import { SentinelXError } from '@sentinelx/shared';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errorCode = 'SYSTEM_001';
    let errors: Array<{ code: string; message: string; field?: string }> = [];

    if (exception instanceof SentinelXError) {
      statusCode = exception.statusCode;
      message = exception.message;
      errorCode = exception.code;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string | undefined) ?? message;

        if (Array.isArray(resp['message'])) {
          errors = (resp['message'] as string[]).map((m) => ({
            code: 'VALIDATION_001',
            message: m,
          }));
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      statusCode = prismaError.statusCode;
      message = prismaError.message;
      errorCode = prismaError.code;
    } else if (this.isZodError(exception)) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      message = 'Validation failed';
      errorCode = 'VALIDATION_001';
      errors = (exception as ZodError).errors.map((e) => ({
        code: 'VALIDATION_001',
        message: e.message,
        field: e.path.join('.'),
      }));
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        { err: exception, requestId, path: request.url, method: request.method },
        'Unhandled exception',
      );
    }

    if (statusCode >= 500) {
      this.logger.error(
        {
          exception: exception instanceof Error ? exception.stack : String(exception),
          requestId,
          path: request.url,
          method: request.method,
          statusCode,
        },
        message,
      );
    }

    const errorResponse: ApiResponse<null> = {
      success: false,
      data: null,
      message,
      errors: errors.length > 0 ? errors : [{ code: errorCode, message }],
      requestId,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(errorResponse);
  }

  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    code: string;
  } {
    switch (error.code) {
      case 'P2002': {
        const fields = (error.meta?.['target'] as string[] | undefined)?.join(', ') ?? 'unknown';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${fields} already exists`,
          code: 'SYSTEM_004',
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found',
          code: 'SYSTEM_003',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint violation',
          code: 'VALIDATION_001',
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'The change you are trying to make would violate a required relation',
          code: 'VALIDATION_001',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'A database error occurred',
          code: 'SYSTEM_001',
        };
    }
  }

  private isZodError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'errors' in error &&
      Array.isArray((error as Record<string, unknown>)['errors']) &&
      'name' in error &&
      (error as Record<string, unknown>)['name'] === 'ZodError'
    );
  }
}

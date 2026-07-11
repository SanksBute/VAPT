export const ERROR_CODES = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_TOKEN_EXPIRED: 'AUTH_002',
  AUTH_TOKEN_INVALID: 'AUTH_003',
  AUTH_MFA_REQUIRED: 'AUTH_004',
  AUTH_MFA_INVALID: 'AUTH_005',
  AUTH_ACCOUNT_LOCKED: 'AUTH_006',
  AUTH_ACCOUNT_SUSPENDED: 'AUTH_007',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_008',
  AUTH_SESSION_REVOKED: 'AUTH_009',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_010',
  AUTH_RATE_LIMITED: 'AUTH_011',

  // Organization
  ORG_NOT_FOUND: 'ORG_001',
  ORG_SUSPENDED: 'ORG_002',
  ORG_LIMIT_EXCEEDED: 'ORG_003',
  ORG_SLUG_TAKEN: 'ORG_004',
  ORG_FEATURE_NOT_ENABLED: 'ORG_005',

  // Users
  USER_NOT_FOUND: 'USER_001',
  USER_EMAIL_TAKEN: 'USER_002',
  USER_SUSPENDED: 'USER_003',

  // Assets
  ASSET_NOT_FOUND: 'ASSET_001',
  ASSET_DUPLICATE: 'ASSET_002',
  ASSET_LIMIT_EXCEEDED: 'ASSET_003',

  // Scans
  SCAN_NOT_FOUND: 'SCAN_001',
  SCAN_LIMIT_EXCEEDED: 'SCAN_002',
  SCAN_ALREADY_RUNNING: 'SCAN_003',
  SCAN_CANNOT_CANCEL: 'SCAN_004',
  SCAN_INVALID_TARGET: 'SCAN_005',
  SCANNER_UNAVAILABLE: 'SCAN_006',

  // Vulnerabilities
  VULN_NOT_FOUND: 'VULN_001',

  // Reports
  REPORT_NOT_FOUND: 'REPORT_001',
  REPORT_GENERATION_FAILED: 'REPORT_002',
  REPORT_EXPIRED: 'REPORT_003',

  // Billing
  BILLING_SUBSCRIPTION_REQUIRED: 'BILLING_001',
  BILLING_PAYMENT_FAILED: 'BILLING_002',
  BILLING_PLAN_NOT_FOUND: 'BILLING_003',

  // AI
  AI_PROVIDER_ERROR: 'AI_001',
  AI_TOKEN_LIMIT_EXCEEDED: 'AI_002',
  AI_RATE_LIMITED: 'AI_003',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_001',
  INVALID_INPUT: 'VALIDATION_002',

  // System
  INTERNAL_ERROR: 'SYSTEM_001',
  SERVICE_UNAVAILABLE: 'SYSTEM_002',
  NOT_FOUND: 'SYSTEM_003',
  CONFLICT: 'SYSTEM_004',
  RATE_LIMITED: 'SYSTEM_005',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class SentinelXError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SentinelXError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends SentinelXError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id !== undefined ? ` with id '${id}'` : ''} not found`,
      ERROR_CODES.NOT_FOUND,
      404,
    );
  }
}

export class UnauthorizedError extends SentinelXError {
  constructor(message: string = 'Unauthorized') {
    super(message, ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS, 403);
  }
}

export class ValidationError extends SentinelXError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 422, details);
  }
}

export class ConflictError extends SentinelXError {
  constructor(message: string) {
    super(message, ERROR_CODES.CONFLICT, 409);
  }
}

export class RateLimitError extends SentinelXError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', ERROR_CODES.RATE_LIMITED, 429, {
      retryAfter,
    });
  }
}

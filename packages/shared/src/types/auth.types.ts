export interface JwtPayload {
  sub: string;
  email: string;
  orgId?: string;
  role?: string;
  permissions?: string[];
  sessionId: string;
  type: 'access' | 'refresh' | 'api';
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface MfaChallenge {
  challengeToken: string;
  method: MfaMethodType;
  expiresAt: string;
  maskedTarget?: string;
}

export type MfaMethodType = 'TOTP' | 'SMS' | 'EMAIL' | 'HARDWARE_KEY';

export interface AuthContext {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
  permissions: string[];
  sessionId: string;
  ipAddress: string;
  userAgent?: string;
}

export interface OAuthProfile {
  provider: string;
  providerUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  rawProfile: Record<string, unknown>;
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  userAgent: string;
  platform?: string;
  browser?: string;
  isMobile?: boolean;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number;
  maxAge: number;
}

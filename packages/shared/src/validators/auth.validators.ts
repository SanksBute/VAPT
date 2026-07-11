import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.validators';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
  mfaCode: z.string().length(6).optional(),
  deviceInfo: z
    .object({
      userAgent: z.string().max(512),
      platform: z.string().max(100).optional(),
      browser: z.string().max(100).optional(),
    })
    .optional(),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  organizationName: z.string().min(2).max(255).trim().optional(),
  timezone: z.string().max(100).default('UTC'),
  locale: z.string().max(10).default('en'),
  invitationToken: z.string().max(255).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(255),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1).max(255),
});

export const enableMfaSchema = z.object({
  method: z.enum(['TOTP', 'SMS', 'EMAIL']),
  phoneNumber: z.string().max(50).optional(),
});

export const verifyMfaSchema = z.object({
  code: z.string().min(6).max(8),
  challengeToken: z.string().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255).trim(),
  scopes: z.array(z.string()).default([]),
  allowedIps: z.array(z.string()).default([]),
  expiresAt: z.coerce.date().optional(),
  rateLimitRpm: z.number().int().min(1).max(10000).default(100),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type CreateApiKeyDto = z.infer<typeof createApiKeySchema>;

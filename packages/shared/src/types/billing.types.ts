export type SubscriptionStatusType = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAUSED';
export type BillingIntervalType = 'MONTHLY' | 'ANNUALLY' | 'QUARTERLY';

export interface PlanLimits {
  users: number;
  assets: number;
  scansPerMonth: number;
  apiCallsPerDay: number;
  reportStorage: string;
  dataRetentionDays: number;
  concurrentScans: number;
  webhooks: number;
  integrations: number;
}

export interface UsageMetrics {
  currentUsers: number;
  currentAssets: number;
  scansThisMonth: number;
  apiCallsToday: number;
  storageUsedBytes: number;
  lastUpdatedAt: string;
}

export interface BillingInfo {
  customerId?: string;
  paymentMethod?: PaymentMethodInfo;
  nextBillingDate?: string;
  amount?: number;
  currency?: string;
}

export interface PaymentMethodInfo {
  type: 'card' | 'bank_account' | 'invoice';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

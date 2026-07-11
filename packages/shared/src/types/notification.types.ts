export type NotificationChannelType = 'IN_APP' | 'EMAIL' | 'SLACK' | 'TEAMS' | 'PAGERDUTY' | 'WEBHOOK' | 'SMS';
export type NotificationSeverityType = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface NotificationEvent {
  type: string;
  severity: NotificationSeverityType;
  organizationId: string;
  userId?: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

export interface NotificationTemplate {
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: NotificationAttachment[];
}

export interface NotificationAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export const NOTIFICATION_EVENTS = {
  SCAN_COMPLETED: 'scan.completed',
  SCAN_FAILED: 'scan.failed',
  VULNERABILITY_CRITICAL: 'vulnerability.critical_detected',
  VULNERABILITY_SLA_BREACH: 'vulnerability.sla_breached',
  VULNERABILITY_RESOLVED: 'vulnerability.resolved',
  ASSET_DISCOVERED: 'asset.discovered',
  ASSET_DECOMMISSIONED: 'asset.decommissioned',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_SLA_BREACH: 'ticket.sla_breached',
  REPORT_READY: 'report.ready',
  COMPLIANCE_FAILED: 'compliance.control_failed',
  USER_INVITED: 'user.invited',
  LOGIN_SUSPICIOUS: 'auth.suspicious_login',
  API_KEY_EXPIRING: 'auth.api_key_expiring',
  SUBSCRIPTION_EXPIRING: 'billing.subscription_expiring',
  PAYMENT_FAILED: 'billing.payment_failed',
} as const;

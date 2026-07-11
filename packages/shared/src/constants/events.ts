// Platform-wide event types for message queue and WebSocket
export const EVENTS = {
  // Scan events
  SCAN_CREATED: 'scan.created',
  SCAN_QUEUED: 'scan.queued',
  SCAN_STARTED: 'scan.started',
  SCAN_PROGRESS: 'scan.progress',
  SCAN_COMPLETED: 'scan.completed',
  SCAN_FAILED: 'scan.failed',
  SCAN_CANCELLED: 'scan.cancelled',
  SCAN_PAUSED: 'scan.paused',
  SCAN_RESUMED: 'scan.resumed',

  // Scanner job events
  SCANNER_JOB_CREATED: 'scanner_job.created',
  SCANNER_JOB_STARTED: 'scanner_job.started',
  SCANNER_JOB_COMPLETED: 'scanner_job.completed',
  SCANNER_JOB_FAILED: 'scanner_job.failed',

  // Vulnerability events
  VULNERABILITY_CREATED: 'vulnerability.created',
  VULNERABILITY_UPDATED: 'vulnerability.updated',
  VULNERABILITY_RESOLVED: 'vulnerability.resolved',
  VULNERABILITY_REOPENED: 'vulnerability.reopened',
  VULNERABILITY_CRITICAL_DETECTED: 'vulnerability.critical_detected',
  VULNERABILITY_SLA_BREACHED: 'vulnerability.sla_breached',
  VULNERABILITY_EXPLOIT_DETECTED: 'vulnerability.exploit_detected',

  // Asset events
  ASSET_DISCOVERED: 'asset.discovered',
  ASSET_UPDATED: 'asset.updated',
  ASSET_DECOMMISSIONED: 'asset.decommissioned',
  ASSET_RISK_CHANGED: 'asset.risk_changed',

  // User events
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_MFA_ENABLED: 'user.mfa_enabled',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_INVITED: 'user.invited',
  USER_SUSPENDED: 'user.suspended',

  // Organization events
  ORG_CREATED: 'org.created',
  ORG_UPDATED: 'org.updated',
  ORG_SUSPENDED: 'org.suspended',
  ORG_MEMBER_ADDED: 'org.member_added',
  ORG_MEMBER_REMOVED: 'org.member_removed',

  // Report events
  REPORT_REQUESTED: 'report.requested',
  REPORT_GENERATING: 'report.generating',
  REPORT_COMPLETED: 'report.completed',
  REPORT_FAILED: 'report.failed',

  // AI events
  AI_ANALYSIS_REQUESTED: 'ai.analysis_requested',
  AI_ANALYSIS_COMPLETED: 'ai.analysis_completed',
  AI_CHAT_MESSAGE: 'ai.chat_message',

  // Compliance events
  COMPLIANCE_ASSESSMENT_STARTED: 'compliance.assessment_started',
  COMPLIANCE_ASSESSMENT_COMPLETED: 'compliance.assessment_completed',
  COMPLIANCE_CONTROL_FAILED: 'compliance.control_failed',

  // Billing events
  SUBSCRIPTION_CREATED: 'billing.subscription_created',
  SUBSCRIPTION_UPDATED: 'billing.subscription_updated',
  SUBSCRIPTION_CANCELLED: 'billing.subscription_cancelled',
  PAYMENT_SUCCEEDED: 'billing.payment_succeeded',
  PAYMENT_FAILED: 'billing.payment_failed',
  TRIAL_ENDING: 'billing.trial_ending',

  // Notification events
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_FAILED: 'notification.failed',

  // Threat intel events
  THREAT_INTEL_UPDATED: 'threat_intel.updated',
  IOC_MATCHED: 'threat_intel.ioc_matched',

  // System events
  SYSTEM_MAINTENANCE: 'system.maintenance',
  WORKER_HEALTH: 'system.worker_health',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

// RabbitMQ queue names
export const QUEUES = {
  SCAN_JOBS: 'sentinelx.scan.jobs',
  SCAN_RESULTS: 'sentinelx.scan.results',
  VULNERABILITY_PROCESSING: 'sentinelx.vuln.processing',
  REPORT_GENERATION: 'sentinelx.report.generation',
  NOTIFICATION_DELIVERY: 'sentinelx.notification.delivery',
  AI_PROCESSING: 'sentinelx.ai.processing',
  THREAT_INTEL_SYNC: 'sentinelx.threat_intel.sync',
  ASSET_DISCOVERY: 'sentinelx.asset.discovery',
  COMPLIANCE_ASSESSMENT: 'sentinelx.compliance.assessment',
  WEBHOOK_DELIVERY: 'sentinelx.webhook.delivery',
  EMAIL_DELIVERY: 'sentinelx.email.delivery',
  AUDIT_LOG: 'sentinelx.audit.log',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Exchange names
export const EXCHANGES = {
  SENTINELX_EVENTS: 'sentinelx.events',
  SENTINELX_DEAD_LETTER: 'sentinelx.dead_letter',
} as const;

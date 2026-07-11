import { z } from 'zod';

export const createScanSchema = z.object({
  name: z.string().min(1).max(500).trim(),
  description: z.string().max(2000).optional(),
  scanType: z.enum([
    'DISCOVERY', 'PORT_SCAN', 'VULNERABILITY_ASSESSMENT', 'WEB_APPLICATION',
    'API_SECURITY', 'CLOUD_SECURITY', 'CONTAINER_SECURITY', 'KUBERNETES_SECURITY',
    'AD_SECURITY', 'CODE_ANALYSIS', 'SECRET_DETECTION', 'PENETRATION_TEST',
    'COMPLIANCE', 'THREAT_INTEL', 'FULL',
  ]),
  targets: z.array(z.string().min(1).max(500)).min(1).max(1000),
  excludeTargets: z.array(z.string().max(500)).default([]),
  scanners: z.array(z.enum([
    'NMAP', 'MASSCAN', 'RUSTSCAN', 'OPENVAS', 'ZAP', 'NIKTO', 'SQLMAP',
    'NUCLEI', 'TRIVY', 'SCOUTSUITE', 'PROWLER', 'SEMGREP', 'MOBSF',
    'LYNIS', 'OSQUERY', 'FALCO', 'CUSTOM',
  ])).optional(),
  profileId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(10).default(5),
  configuration: z.record(z.unknown()).default({}),
  credentials: z.record(z.unknown()).optional(),
  tags: z.array(z.string().max(100)).default([]),
});

export const updateScanSchema = createScanSchema.partial();

export const createScanScheduleSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional(),
  scanType: z.enum([
    'DISCOVERY', 'PORT_SCAN', 'VULNERABILITY_ASSESSMENT', 'WEB_APPLICATION',
    'API_SECURITY', 'CLOUD_SECURITY', 'CONTAINER_SECURITY', 'KUBERNETES_SECURITY',
    'AD_SECURITY', 'CODE_ANALYSIS', 'SECRET_DETECTION', 'PENETRATION_TEST',
    'COMPLIANCE', 'THREAT_INTEL', 'FULL',
  ]),
  configuration: z.record(z.unknown()).default({}),
  targets: z.array(z.string()).default([]),
  frequency: z.enum(['ONCE', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM_CRON']),
  cronExpression: z.string().max(100).optional(),
  timezone: z.string().max(100).default('UTC'),
  isActive: z.boolean().default(true),
  maxRuns: z.number().int().min(1).optional(),
  notifications: z.array(z.record(z.unknown())).default([]),
});

export type CreateScanDto = z.infer<typeof createScanSchema>;
export type CreateScanScheduleDto = z.infer<typeof createScanScheduleSchema>;

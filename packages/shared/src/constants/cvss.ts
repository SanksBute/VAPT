// CVSS v3.1 severity thresholds
export const CVSS_V3_SEVERITY = {
  NONE: { min: 0.0, max: 0.0, label: 'None' },
  LOW: { min: 0.1, max: 3.9, label: 'Low' },
  MEDIUM: { min: 4.0, max: 6.9, label: 'Medium' },
  HIGH: { min: 7.0, max: 8.9, label: 'High' },
  CRITICAL: { min: 9.0, max: 10.0, label: 'Critical' },
} as const;

export type CvssSeverityLevel = keyof typeof CVSS_V3_SEVERITY;

export function getCvssV3Severity(score: number): CvssSeverityLevel {
  if (score === 0) return 'NONE';
  if (score <= 3.9) return 'LOW';
  if (score <= 6.9) return 'MEDIUM';
  if (score <= 8.9) return 'HIGH';
  return 'CRITICAL';
}

// SLA deadlines by severity (in days)
export const SLA_DAYS_BY_SEVERITY = {
  CRITICAL: 1,
  HIGH: 7,
  MEDIUM: 30,
  LOW: 90,
  INFORMATIONAL: 180,
  NONE: 365,
} as const;

// Risk score multipliers
export const RISK_MULTIPLIERS = {
  EXPLOIT_AVAILABLE: 1.5,
  EXPLOIT_IN_WILD: 2.0,
  INTERNET_EXPOSED: 1.3,
  CRITICAL_ASSET: 1.4,
  HIGH_ASSET: 1.2,
  SLA_BREACHED: 1.2,
  PATCH_AVAILABLE: 0.9,
} as const;

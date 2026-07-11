import { getCvssV3Severity, CVSS_V3_SEVERITY, SLA_DAYS_BY_SEVERITY, RISK_MULTIPLIERS } from '../constants/cvss';

export { getCvssV3Severity };

export function calculateRiskScore(params: {
  cvssScore: number;
  exploitAvailable: boolean;
  exploitInTheWild: boolean;
  internetExposed: boolean;
  assetCriticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  patchAvailable: boolean;
  epssScore?: number;
}): number {
  let score = params.cvssScore * 10; // Base score 0-100

  if (params.exploitInTheWild) {
    score *= RISK_MULTIPLIERS.EXPLOIT_IN_WILD;
  } else if (params.exploitAvailable) {
    score *= RISK_MULTIPLIERS.EXPLOIT_AVAILABLE;
  }

  if (params.internetExposed) {
    score *= RISK_MULTIPLIERS.INTERNET_EXPOSED;
  }

  if (params.assetCriticality === 'CRITICAL') {
    score *= RISK_MULTIPLIERS.CRITICAL_ASSET;
  } else if (params.assetCriticality === 'HIGH') {
    score *= RISK_MULTIPLIERS.HIGH_ASSET;
  }

  if (params.patchAvailable) {
    score *= RISK_MULTIPLIERS.PATCH_AVAILABLE;
  }

  if (params.epssScore !== undefined) {
    const epssMultiplier = 1 + params.epssScore;
    score *= epssMultiplier;
  }

  return Math.min(100, Math.round(score * 10) / 10);
}

export function calculateSlaDeadline(
  severity: keyof typeof CVSS_V3_SEVERITY | 'INFORMATIONAL' | 'NONE',
  detectedAt: Date = new Date(),
): Date {
  const slaDays = SLA_DAYS_BY_SEVERITY[severity as keyof typeof SLA_DAYS_BY_SEVERITY] ?? 90;
  const deadline = new Date(detectedAt);
  deadline.setDate(deadline.getDate() + slaDays);
  return deadline;
}

export function isSlaBreached(slaDeadline: Date | null): boolean {
  if (slaDeadline === null) return false;
  return new Date() > slaDeadline;
}

export function calculatePriorityScore(params: {
  riskScore: number;
  slaBreached: boolean;
  exploitInTheWild: boolean;
  assetCriticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
}): number {
  let priority = params.riskScore;

  if (params.slaBreached) {
    priority *= RISK_MULTIPLIERS.SLA_BREACHED;
  }

  if (params.exploitInTheWild) {
    priority = Math.min(100, priority * 1.2);
  }

  return Math.min(100, Math.round(priority * 10) / 10);
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    CRITICAL: '#dc2626',
    HIGH: '#ea580c',
    MEDIUM: '#d97706',
    LOW: '#2563eb',
    INFORMATIONAL: '#6b7280',
    NONE: '#9ca3af',
  };
  return colors[severity] ?? '#6b7280';
}

export function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    INFORMATIONAL: 'Info',
    NONE: 'None',
  };
  return labels[severity] ?? severity;
}

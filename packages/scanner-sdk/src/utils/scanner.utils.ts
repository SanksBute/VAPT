import { validateCidrOrIp } from '@sentinelx/shared';

export function isValidScanTarget(target: string): boolean {
  if (!target || target.trim().length === 0) return false;

  // IP or CIDR
  if (validateCidrOrIp(target)) return true;

  // URL
  try {
    const url = new URL(target.startsWith('http') ? target : `https://${target}`);
    return url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function parseTargetList(input: string): string[] {
  return input
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && isValidScanTarget(t));
}

export function estimateScanDuration(
  targetCount: number,
  scanType: string,
  configuration: Record<string, unknown>,
): number {
  const baseSeconds: Record<string, number> = {
    DISCOVERY: 30,
    PORT_SCAN: 60,
    VULNERABILITY_ASSESSMENT: 300,
    WEB_APPLICATION: 600,
    API_SECURITY: 300,
    CLOUD_SECURITY: 120,
    CONTAINER_SECURITY: 120,
    KUBERNETES_SECURITY: 180,
    AD_SECURITY: 300,
    CODE_ANALYSIS: 180,
    SECRET_DETECTION: 60,
    PENETRATION_TEST: 3600,
    COMPLIANCE: 600,
    FULL: 7200,
  };

  const base = baseSeconds[scanType] ?? 300;
  const ports = configuration['ports'] as string | undefined;
  const portMultiplier = ports?.includes('1-65535') ? 3 : 1;

  return base * targetCount * portMultiplier;
}

export function generateWorkDir(jobId: string, baseDir: string = '/tmp/sentinelx'): string {
  return `${baseDir}/${jobId}`;
}

export function sanitizeTarget(target: string): string {
  return target.replace(/[;&|`$(){}[\]\\<>'"]/g, '').trim();
}

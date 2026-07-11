import { getCvssV3Severity } from '../constants/cvss';

export { getCvssV3Severity };

export function parseCvssV3Vector(vector: string): Record<string, string> {
  const parts = vector.split('/');
  const result: Record<string, string> = {};

  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    const key = part.substring(0, colonIndex);
    const value = part.substring(colonIndex + 1);
    if (key !== undefined && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export function formatCvssScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'N/A';
  return score.toFixed(1);
}

export function getCvssRating(score: number): string {
  const severity = getCvssV3Severity(score);
  return severity.charAt(0) + severity.slice(1).toLowerCase();
}

export function calculateBaseScore(vector: string): number | null {
  // Simplified CVSS 3.1 base score calculation
  const parts = parseCvssV3Vector(vector);

  const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
  const AC = { L: 0.77, H: 0.44 };
  const PR: Record<string, Record<string, number>> = {
    CHANGED: { N: 0.85, L: 0.68, H: 0.5 },
    UNCHANGED: { N: 0.85, L: 0.62, H: 0.27 },
  };
  const UI = { N: 0.85, R: 0.62 };
  const CIA = { N: 0, L: 0.22, H: 0.56 };

  const scope = parts['S'] ?? 'U';
  const avKey = parts['AV'] as keyof typeof AV;
  const acKey = parts['AC'] as keyof typeof AC;
  const prKey = parts['PR'] as string;
  const uiKey = parts['UI'] as keyof typeof UI;
  const cKey = parts['C'] as keyof typeof CIA;
  const iKey = parts['I'] as keyof typeof CIA;
  const aKey = parts['A'] as keyof typeof CIA;

  if (!avKey || !acKey || !prKey || !uiKey || !cKey || !iKey || !aKey) return null;

  const avVal = AV[avKey];
  const acVal = AC[acKey];
  const prVal = scope === 'C' ? PR['CHANGED']?.[prKey] : PR['UNCHANGED']?.[prKey];
  const uiVal = UI[uiKey];
  const cVal = CIA[cKey];
  const iVal = CIA[iKey];
  const aVal = CIA[aKey];

  if (avVal === undefined || acVal === undefined || prVal === undefined || uiVal === undefined || cVal === undefined || iVal === undefined || aVal === undefined) {
    return null;
  }

  const exploitability = 8.22 * avVal * acVal * prVal * uiVal;
  const iscBase = 1 - (1 - cVal) * (1 - iVal) * (1 - aVal);

  let isc: number;
  if (scope === 'U') {
    isc = 6.42 * iscBase;
  } else {
    isc = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(iscBase - 0.02, 15);
  }

  if (isc <= 0) return 0;

  let baseScore: number;
  if (scope === 'U') {
    baseScore = Math.min(10, 1.08 * (isc + exploitability));
  } else {
    baseScore = Math.min(10, 1.08 * (isc + exploitability));
  }

  return Math.round(baseScore * 10) / 10;
}

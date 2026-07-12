import { getCvssV3Severity } from '../constants/cvss';

export function parseCvssV3Vector(vector: string): Map<string, string> {
  const parts = vector.split('/');
  const result = new Map<string, string>();

  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    const key = part.substring(0, colonIndex);
    const value = part.substring(colonIndex + 1);
    result.set(key, value);
  }
  return result;
}

export function formatCvssScore(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return 'N/A';
  }
  return score.toFixed(1);
}

export function getCvssRating(score: number): string {
  const severity = getCvssV3Severity(score);
  return severity.charAt(0) + severity.slice(1).toLowerCase();
}

export function calculateBaseScore(vector: string): number | null {
  // Simplified CVSS 3.1 base score calculation
  const parts = parseCvssV3Vector(vector);

  const AV = new Map([
    ['N', 0.85],
    ['A', 0.62],
    ['L', 0.55],
    ['P', 0.2],
  ]);
  const AC = new Map([
    ['L', 0.77],
    ['H', 0.44],
  ]);
  const PR_CHANGED = new Map([
    ['N', 0.85],
    ['L', 0.68],
    ['H', 0.5],
  ]);
  const PR_UNCHANGED = new Map([
    ['N', 0.85],
    ['L', 0.62],
    ['H', 0.27],
  ]);
  const UI = new Map([
    ['N', 0.85],
    ['R', 0.62],
  ]);
  const CIA = new Map([
    ['N', 0],
    ['L', 0.22],
    ['H', 0.56],
  ]);

  const scope = parts.get('S') ?? 'U';
  const avKey = parts.get('AV');
  const acKey = parts.get('AC');
  const prKey = parts.get('PR');
  const uiKey = parts.get('UI');
  const cKey = parts.get('C');
  const iKey = parts.get('I');
  const aKey = parts.get('A');

  if (
    avKey === undefined ||
    acKey === undefined ||
    prKey === undefined ||
    uiKey === undefined ||
    cKey === undefined ||
    iKey === undefined ||
    aKey === undefined
  ) {
    return null;
  }

  const avVal = AV.get(avKey);
  const acVal = AC.get(acKey);
  const prVal = scope === 'C' ? PR_CHANGED.get(prKey) : PR_UNCHANGED.get(prKey);
  const uiVal = UI.get(uiKey);
  const cVal = CIA.get(cKey);
  const iVal = CIA.get(iKey);
  const aVal = CIA.get(aKey);

  if (
    avVal === undefined ||
    acVal === undefined ||
    prVal === undefined ||
    uiVal === undefined ||
    cVal === undefined ||
    iVal === undefined ||
    aVal === undefined
  ) {
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

  if (isc <= 0) {
    return 0;
  }

  const baseScore = Math.min(10, 1.08 * (isc + exploitability));

  return Math.round(baseScore * 10) / 10;
}

export type ComplianceFrameworkType = 'SOC2_TYPE1' | 'SOC2_TYPE2' | 'ISO27001' | 'PCI_DSS_V4' | 'HIPAA' | 'GDPR' | 'NIST_CSF' | 'NIST_SP800_53' | 'MITRE_ATTACK' | 'OWASP_ASVS' | 'CIS_CONTROLS' | 'OWASP_TOP10' | 'DISA_STIG' | 'FedRAMP';
export type ComplianceStatusType = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NOT_APPLICABLE' | 'UNDER_REVIEW';

export interface ComplianceScore {
  overall: number;
  status: ComplianceStatusType;
  controlsTotal: number;
  controlsCompliant: number;
  controlsNonCompliant: number;
  controlsPartial: number;
  controlsNotApplicable: number;
  controlsUnderReview: number;
  criticalGaps: number;
  lastAssessedAt?: string;
}

export interface ControlMapping {
  frameworkId: ComplianceFrameworkType;
  controlId: string;
  controlName: string;
  requirement: string;
  status: ComplianceStatusType;
  evidence: string[];
  gaps: string[];
  remediation: string[];
}

export interface ComplianceTrend {
  date: string;
  score: number;
  compliant: number;
  nonCompliant: number;
}

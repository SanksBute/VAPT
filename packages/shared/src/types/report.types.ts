export type ReportTypeValue = 'EXECUTIVE_SUMMARY' | 'TECHNICAL_DETAIL' | 'COMPLIANCE' | 'RISK_ASSESSMENT' | 'PENETRATION_TEST' | 'VULNERABILITY_MANAGEMENT' | 'ASSET_INVENTORY' | 'AI_SUMMARY';
export type ReportFormatType = 'PDF' | 'WORD' | 'EXCEL' | 'CSV' | 'JSON' | 'HTML';
export type ReportStatusType = 'GENERATING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface ReportConfig {
  title?: string;
  logo?: string;
  includeExecutiveSummary: boolean;
  includeRiskSummary: boolean;
  includeVulnerabilityDetails: boolean;
  includeAssetInventory: boolean;
  includeComplianceSummary: boolean;
  includeRemediation: boolean;
  includeAiAnalysis: boolean;
  dateRange?: { from: string; to: string };
  severityFilter?: string[];
  statusFilter?: string[];
  assetFilter?: string[];
  scanFilter?: string[];
  branding?: ReportBranding;
}

export interface ReportBranding {
  primaryColor?: string;
  secondaryColor?: string;
  logo?: string;
  footer?: string;
  organizationName?: string;
  watermark?: string;
}

export interface ReportSection {
  title: string;
  content: string;
  charts?: ReportChart[];
  tables?: ReportTable[];
  appendix?: boolean;
}

export interface ReportChart {
  type: 'bar' | 'pie' | 'line' | 'donut' | 'heatmap' | 'treemap';
  title: string;
  data: Record<string, unknown>;
  width?: number;
  height?: number;
}

export interface ReportTable {
  title?: string;
  headers: string[];
  rows: (string | number | boolean)[][];
}

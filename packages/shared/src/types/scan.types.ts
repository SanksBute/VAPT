export type ScanStatusType =
  | 'PENDING'
  | 'QUEUED'
  | 'INITIALIZING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PARTIAL'
  | 'TIMEOUT';
export type ScanTypeValue =
  | 'DISCOVERY'
  | 'PORT_SCAN'
  | 'VULNERABILITY_ASSESSMENT'
  | 'WEB_APPLICATION'
  | 'API_SECURITY'
  | 'CLOUD_SECURITY'
  | 'CONTAINER_SECURITY'
  | 'KUBERNETES_SECURITY'
  | 'AD_SECURITY'
  | 'CODE_ANALYSIS'
  | 'SECRET_DETECTION'
  | 'PENETRATION_TEST'
  | 'COMPLIANCE'
  | 'THREAT_INTEL'
  | 'FULL';
export type ScannerTypeValue =
  | 'NMAP'
  | 'MASSCAN'
  | 'RUSTSCAN'
  | 'OPENVAS'
  | 'ZAP'
  | 'NIKTO'
  | 'SQLMAP'
  | 'NUCLEI'
  | 'TRIVY'
  | 'SCOUTSUITE'
  | 'PROWLER'
  | 'SEMGREP'
  | 'MOBSF'
  | 'LYNIS'
  | 'OSQUERY'
  | 'FALCO'
  | 'CUSTOM';

export interface ScanConfiguration {
  ports?: string;
  portScanType?: 'SYN' | 'CONNECT' | 'UDP' | 'COMPREHENSIVE';
  timing?: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
  osDetection?: boolean;
  serviceDetection?: boolean;
  scriptScan?: boolean;
  scripts?: string[];
  maxDepth?: number;
  followRedirects?: boolean;
  userAgent?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  authentication?: ScanAuthentication;
  rateLimit?: number;
  timeout?: number;
  retries?: number;
  parallelism?: number;
  excludePaths?: string[];
  includePaths?: string[];
  customOptions?: Record<string, unknown>;
}

export interface ScanAuthentication {
  type: 'none' | 'basic' | 'bearer' | 'cookie' | 'form' | 'oauth2' | 'api_key';
  username?: string;
  password?: string;
  token?: string;
  cookies?: Record<string, string>;
  formConfig?: {
    loginUrl: string;
    usernameField: string;
    passwordField: string;
    successIndicator: string;
  };
  oauthConfig?: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope: string;
  };
}

export interface ScanScope {
  targets: string[];
  excludeTargets?: string[];
  maxHosts?: number;
  maxUrls?: number;
  allowedDomains?: string[];
  ipRanges?: string[];
}

export interface ScanProgress {
  scanId: string;
  status: ScanStatusType;
  progress: number;
  totalTargets: number;
  scannedTargets: number;
  currentTarget?: string;
  findings: number;
  startedAt?: string;
  estimatedCompletion?: string;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  events: ScanProgressEvent[];
}

export interface ScanProgressEvent {
  timestamp: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

export interface ScannerCapability {
  scanner: ScannerTypeValue;
  supportedScanTypes: ScanTypeValue[];
  supportedTargetTypes: string[];
  requiresCredentials: boolean;
  supportsParallel: boolean;
  supportsResume: boolean;
  maxTargets: number;
  estimatedDurationMultiplier: number;
  outputFormats: string[];
  version?: string;
  isAvailable: boolean;
}

export interface NormalizedFinding {
  scanner: string;
  pluginId?: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
  /** Marks a finding produced by the demo-mode simulator rather than a real scanner run. */
  source?: 'REAL' | 'SIMULATED';
  target: string;
  port?: number;
  protocol?: string;
  service?: string;
  url?: string;
  parameter?: string;
  method?: string;
  cveIds: string[];
  cweIds: string[];
  cvssV3Score?: number;
  cvssV3Vector?: string;
  solution?: string;
  references: string[];
  evidence?: string;
  request?: string;
  response?: string;
  payload?: string;
  rawData?: Record<string, unknown>;
  fingerprint: string;
}

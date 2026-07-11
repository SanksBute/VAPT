import type { NormalizedFinding, ScanConfiguration, ScannerTypeValue, ScanTypeValue } from '@sentinelx/shared';

export interface ScannerMetadata {
  type: ScannerTypeValue;
  version: string;
  displayName: string;
  description: string;
  supportedScanTypes: ScanTypeValue[];
  supportedTargetTypes: ScannerTargetType[];
  requiresCredentials: boolean;
  supportsParallel: boolean;
  supportsResume: boolean;
  maxTargets: number;
  defaultTimeout: number;
  outputFormat: string;
  dockerImage?: string;
  executablePath?: string;
  configSchema?: Record<string, unknown>;
}

export type ScannerTargetType =
  | 'ip'
  | 'cidr'
  | 'hostname'
  | 'url'
  | 'domain'
  | 'container_image'
  | 'repository'
  | 'cloud_account'
  | 'kubernetes_cluster'
  | 'ad_domain'
  | 'file_path';

export interface ScannerContext {
  jobId: string;
  scanId: string;
  organizationId: string;
  target: string;
  targetType: ScannerTargetType;
  configuration: ScanConfiguration;
  credentials?: ScannerCredentials;
  workDir: string;
  outputDir: string;
  timeout: number;
  onProgress: (progress: number, message?: string) => Promise<void>;
  onEvent: (type: string, message: string, data?: Record<string, unknown>) => Promise<void>;
}

export interface ScannerCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
  privateKey?: string;
  certificates?: {
    cert: string;
    key: string;
    ca?: string;
  };
  oauth?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scope?: string;
  };
  cloud?: {
    provider: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    roleArn?: string;
    region?: string;
  };
}

export interface ScannerResult {
  jobId: string;
  scanId: string;
  scanner: ScannerTypeValue;
  target: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  exitCode?: number;
  findings: NormalizedFinding[];
  rawOutput: string;
  metadata: Record<string, unknown>;
  statistics: ScannerStatistics;
}

export interface ScannerStatistics {
  totalHosts?: number;
  upHosts?: number;
  totalPorts?: number;
  openPorts?: number;
  totalUrls?: number;
  testedUrls?: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  infoFindings: number;
  scanDurationSeconds: number;
  bytesTransferred?: number;
}

export interface ScannerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  resolvedTarget?: string;
}

export interface IScanner {
  readonly metadata: ScannerMetadata;

  /**
   * Initialize the scanner — verify availability, binary paths, Docker images
   */
  initialize(): Promise<void>;

  /**
   * Validate the scan configuration and target before execution
   */
  validate(context: ScannerContext): Promise<ScannerValidationResult>;

  /**
   * Execute the scan and return raw output
   */
  scan(context: ScannerContext): Promise<string>;

  /**
   * Parse the raw scanner output into a normalized format
   */
  parse(rawOutput: string, context: ScannerContext): Promise<NormalizedFinding[]>;

  /**
   * Normalize findings — apply deduplication, severity mapping, fingerprinting
   */
  normalize(findings: NormalizedFinding[], context: ScannerContext): NormalizedFinding[];

  /**
   * Generate evidence artifacts (screenshots, request/response pairs)
   */
  generateEvidence(
    finding: NormalizedFinding,
    context: ScannerContext,
  ): Promise<Record<string, unknown>>;

  /**
   * Clean up temporary files and resources after scan completion
   */
  cleanup(context: ScannerContext): Promise<void>;

  /**
   * Check if the scanner binary/Docker image is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the scanner version
   */
  getVersion(): Promise<string>;
}

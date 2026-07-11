export type AssetTypeValue = 'SERVER' | 'WORKSTATION' | 'NETWORK_DEVICE' | 'CLOUD_INSTANCE' | 'CONTAINER' | 'KUBERNETES_POD' | 'WEB_APPLICATION' | 'API_ENDPOINT' | 'DATABASE' | 'DOMAIN' | 'IP_ADDRESS' | 'URL' | 'CODE_REPOSITORY' | 'MOBILE_APPLICATION' | 'IOT_DEVICE' | 'VIRTUAL_MACHINE' | 'LOAD_BALANCER' | 'STORAGE_BUCKET' | 'SERVERLESS_FUNCTION' | 'MESSAGE_QUEUE';
export type AssetCriticalityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type AssetStatusType = 'ACTIVE' | 'INACTIVE' | 'DECOMMISSIONED' | 'UNKNOWN' | 'PENDING_REVIEW';

export interface DiscoveredPort {
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered' | 'open|filtered';
  service?: string;
  version?: string;
  banner?: string;
  scripts?: Record<string, string>;
}

export interface DiscoveredService {
  name: string;
  version?: string;
  product?: string;
  extraInfo?: string;
  cpe?: string[];
  port?: number;
  protocol?: string;
}

export interface DiscoveredTechnology {
  name: string;
  version?: string;
  category?: string;
  cpe?: string;
  confidence: number;
}

export interface AssetRiskMetrics {
  riskScore: number;
  exposureScore: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  mediumVulnerabilities: number;
  lowVulnerabilities: number;
  totalVulnerabilities: number;
  openVulnerabilities: number;
  slaBreaches: number;
  lastScanAge: number;
  patchLevel: 'CURRENT' | 'BEHIND' | 'CRITICAL';
  internetExposed: boolean;
  hasExploitableVulns: boolean;
}

export interface AssetDiscoveryResult {
  identifier: string;
  type: AssetTypeValue;
  hostname?: string;
  ipAddresses: string[];
  macAddresses?: string[];
  fqdn?: string;
  operatingSystem?: string;
  osVersion?: string;
  ports: DiscoveredPort[];
  services: DiscoveredService[];
  technologies: DiscoveredTechnology[];
  cloudProvider?: string;
  cloudMetadata?: Record<string, unknown>;
  discoveryMethod: string;
  confidence: number;
  rawData?: Record<string, unknown>;
}

export interface AssetGroupRule {
  field: string;
  operator: string;
  value: unknown;
}

export interface DynamicAssetGroupConfig {
  rules: AssetGroupRule[];
  logic: 'AND' | 'OR';
}

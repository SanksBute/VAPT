import type { NormalizedFinding } from '@sentinelx/shared';
import { XMLParser } from 'fast-xml-parser';
import { BaseScanner } from '../base/base-scanner';
import type { ScannerContext, ScannerMetadata } from '../interfaces/scanner.interface';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ZapParser extends BaseScanner {
  readonly metadata: ScannerMetadata = {
    type: 'ZAP',
    version: '2.15.0',
    displayName: 'OWASP ZAP',
    description: 'OWASP Zed Attack Proxy — world\'s most widely used web app security scanner',
    supportedScanTypes: ['WEB_APPLICATION', 'API_SECURITY'],
    supportedTargetTypes: ['url', 'domain'],
    requiresCredentials: false,
    supportsParallel: false,
    supportsResume: false,
    maxTargets: 1,
    defaultTimeout: 14400,
    outputFormat: 'xml',
    dockerImage: 'ghcr.io/zaproxy/zaproxy:stable',
  };

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('zap.sh -version 2>&1 || docker inspect ghcr.io/zaproxy/zaproxy:stable');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return '2.15.0';
  }

  async scan(context: ScannerContext): Promise<string> {
    const { target, workDir, timeout } = context;
    const configuration = context.configuration as unknown as Record<string, unknown>;
    const reportFile = `${workDir}/zap-${context.jobId}.xml`;

    const zapTarget = this.sanitizeUrl(target);
    const ajaxSpider = configuration['ajaxSpider'] !== false;
    const activeScan = configuration['activeScan'] !== false;
    const apiScan = configuration['apiScan'] === true;

    let command: string;

    if (apiScan) {
      const apiDefinition = configuration['apiDefinition'] as string;
      command = `docker run --rm -v "${workDir}:/zap/wrk:rw" ` +
        `ghcr.io/zaproxy/zaproxy:stable ` +
        `zap-api-scan.py -t "${apiDefinition}" -f openapi ` +
        `-r /zap/wrk/zap-${context.jobId}-report.html ` +
        `-x /zap/wrk/zap-${context.jobId}.xml ` +
        `-I -J /zap/wrk/zap-${context.jobId}.json`;
    } else {
      command = `docker run --rm -v "${workDir}:/zap/wrk:rw" ` +
        `ghcr.io/zaproxy/zaproxy:stable ` +
        `zap-full-scan.py -t "${zapTarget}" ` +
        `-r /zap/wrk/zap-${context.jobId}-report.html ` +
        `-x /zap/wrk/zap-${context.jobId}.xml ` +
        `-J /zap/wrk/zap-${context.jobId}.json ` +
        (ajaxSpider ? '-j ' : '') +
        `-I`;
    }

    await context.onEvent('scan_started', `Starting OWASP ZAP scan on ${target}`);
    await context.onProgress(5, 'Starting ZAP Docker container');

    await execAsync(command, {
      timeout: timeout * 1000,
      maxBuffer: 500 * 1024 * 1024,
    }).catch(() => undefined);

    const fs = await import('fs/promises');
    try {
      return await fs.readFile(reportFile, 'utf-8');
    } catch {
      const jsonFile = reportFile.replace('.xml', '.json');
      try {
        return await fs.readFile(jsonFile, 'utf-8');
      } catch {
        return '';
      }
    }
  }

  async parse(rawOutput: string, context: ScannerContext): Promise<NormalizedFinding[]> {
    const findings: NormalizedFinding[] = [];
    if (!rawOutput.trim()) return findings;

    if (rawOutput.trim().startsWith('<')) {
      return this.parseXml(rawOutput, context.target);
    }

    try {
      const json = JSON.parse(rawOutput) as ZapJsonReport;
      return this.parseJson(json, context.target);
    } catch {
      return findings;
    }
  }

  private parseXml(xml: string, target: string): NormalizedFinding[] {
    const findings: NormalizedFinding[] = [];
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => ['alertitem', 'instance'].includes(name),
    });

    const result = parser.parse(xml) as ZapXmlRoot;
    const alerts = result.OWASPZAPReport?.site?.alerts?.alertitem ?? [];

    for (const alert of alerts) {
      const instances = alert.instances?.instance ?? [];
      const targetUrl = instances[0]?.uri ?? target;
      const method = instances[0]?.method;
      const param = instances[0]?.param;

      const cvssScore = this.mapRiskToScore(alert.riskcode);
      const severity = this.cvssScoreToSeverity(cvssScore);

      findings.push({
        scanner: 'ZAP',
        pluginId: `zap-${alert.pluginid ?? alert.alertRef}`,
        title: alert.alert ?? 'Unknown',
        description: alert.desc ?? '',
        severity,
        target,
        url: targetUrl,
        method: method?.toUpperCase(),
        parameter: param,
        cvssV3Score: cvssScore,
        cveIds: this.extractCveIds(alert.reference ?? ''),
        cweIds: alert.cweid ? [`CWE-${alert.cweid}`] : [],
        solution: alert.solution ?? undefined,
        evidence: alert.evidence ?? instances[0]?.evidence,
        references: alert.reference ? [alert.reference] : [],
        fingerprint: this.generateFingerprint({
          pluginId: alert.pluginid,
          url: targetUrl,
          param,
        }),
      });
    }

    return findings;
  }

  private parseJson(report: ZapJsonReport, target: string): NormalizedFinding[] {
    const findings: NormalizedFinding[] = [];
    const alerts = report.site?.[0]?.alerts ?? [];

    for (const alert of alerts) {
      const instance = alert.instances?.[0];
      const cvssScore = this.mapRiskToScore(String(alert.riskcode ?? 0));
      const severity = this.cvssScoreToSeverity(cvssScore);

      findings.push({
        scanner: 'ZAP',
        pluginId: `zap-${alert.pluginid ?? alert.alertRef}`,
        title: alert.alert ?? 'Unknown',
        description: alert.desc ?? '',
        severity,
        target,
        url: instance?.uri ?? target,
        method: instance?.method?.toUpperCase(),
        parameter: instance?.param,
        cvssV3Score: cvssScore,
        cveIds: this.extractCveIds(alert.reference ?? ''),
        cweIds: alert.cweid ? [`CWE-${alert.cweid}`] : [],
        solution: alert.solution ?? undefined,
        evidence: alert.evidence ?? instance?.evidence,
        references: alert.reference ? [alert.reference] : [],
        fingerprint: this.generateFingerprint({
          pluginId: alert.pluginid,
          url: instance?.uri ?? target,
          param: instance?.param,
        }),
      });
    }

    return findings;
  }

  private mapRiskToScore(riskCode: string | number | undefined): number {
    const code = parseInt(String(riskCode ?? 0), 10);
    const mapping: Record<number, number> = {
      3: 8.5, // High
      2: 5.5, // Medium
      1: 2.5, // Low
      0: 0.0, // Info
    };
    return mapping[code] ?? 0;
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.toString();
    } catch {
      return url;
    }
  }
}

interface ZapXmlRoot {
  OWASPZAPReport?: {
    site?: {
      alerts?: {
        alertitem?: ZapXmlAlert[];
      };
    };
  };
}

interface ZapXmlAlert {
  alert?: string;
  alertRef?: string;
  pluginid?: string;
  riskcode?: string;
  cweid?: string;
  desc?: string;
  solution?: string;
  reference?: string;
  evidence?: string;
  instances?: {
    instance?: Array<{
      uri?: string;
      method?: string;
      param?: string;
      evidence?: string;
    }>;
  };
}

interface ZapJsonReport {
  site?: Array<{
    alerts?: ZapJsonAlert[];
  }>;
}

interface ZapJsonAlert {
  alert?: string;
  alertRef?: string;
  pluginid?: string;
  riskcode?: number;
  cweid?: string;
  desc?: string;
  solution?: string;
  reference?: string;
  evidence?: string;
  instances?: Array<{
    uri?: string;
    method?: string;
    param?: string;
    evidence?: string;
  }>;
}

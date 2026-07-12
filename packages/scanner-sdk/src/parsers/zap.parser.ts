import { execFile } from 'child_process';
import { promisify } from 'util';

import type { NormalizedFinding } from '@sentinelx/shared';
import { XMLParser } from 'fast-xml-parser';

import { BaseScanner } from '../base/base-scanner';
import type { ScannerContext, ScannerMetadata } from '../interfaces/scanner.interface';

const execFileAsync = promisify(execFile);

const ZAP_DOCKER_IMAGE = 'ghcr.io/zaproxy/zaproxy:stable';

export class ZapParser extends BaseScanner {
  readonly metadata: ScannerMetadata = {
    type: 'ZAP',
    version: '2.15.0',
    displayName: 'OWASP ZAP',
    description: "OWASP Zed Attack Proxy — world's most widely used web app security scanner",
    supportedScanTypes: ['WEB_APPLICATION', 'API_SECURITY'],
    supportedTargetTypes: ['url', 'domain'],
    requiresCredentials: false,
    supportsParallel: false,
    supportsResume: false,
    maxTargets: 1,
    defaultTimeout: 14400,
    outputFormat: 'xml',
    dockerImage: ZAP_DOCKER_IMAGE,
  };

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('zap.sh', ['-version']);
      return true;
    } catch {
      try {
        await execFileAsync('docker', ['inspect', ZAP_DOCKER_IMAGE]);
        return true;
      } catch {
        return false;
      }
    }
  }

  getVersion(): Promise<string> {
    return Promise.resolve('2.15.0');
  }

  /**
   * ZAP authenticated DAST configuration, expected under `configuration.auth`:
   * {
   *   type: 'bearer' | 'form',
   *   // bearer: token comes from context.credentials.token / .apiKey
   *   // form:
   *   loginUrl: string,           // page that renders the login form
   *   usernameField: string,      // name attribute of the username input
   *   passwordField: string,      // name attribute of the password input
   *   loggedInIndicator: string,  // regex matched against an authenticated response
   * }
   * Username/password for form auth come from context.credentials.username/.password.
   */
  async scan(context: ScannerContext): Promise<string> {
    const { target, workDir, timeout } = context;
    const configuration = context.configuration as unknown as Record<string, unknown>;
    const reportFile = `${workDir}/zap-${context.jobId}.xml`;

    const zapTarget = this.sanitizeUrl(target);
    const ajaxSpider = configuration['ajaxSpider'] !== false;
    const activeScan = configuration['activeScan'] !== false;
    const apiScan = configuration['apiScan'] === true;

    const dockerArgs = ['run', '--rm', '-v', `${workDir}:/zap/wrk:rw`, ZAP_DOCKER_IMAGE];

    if (apiScan) {
      const apiDefinition = configuration['apiDefinition'];
      if (typeof apiDefinition !== 'string' || !this.isValidHttpUrl(apiDefinition)) {
        throw new Error(`Invalid ZAP API definition URL rejected: ${String(apiDefinition)}`);
      }
      dockerArgs.push(
        'zap-api-scan.py',
        '-t',
        apiDefinition,
        '-f',
        'openapi',
        '-r',
        `/zap/wrk/zap-${context.jobId}-report.html`,
        '-x',
        `/zap/wrk/zap-${context.jobId}.xml`,
        '-I',
        '-J',
        `/zap/wrk/zap-${context.jobId}.json`,
      );
    } else {
      const scriptName = activeScan ? 'zap-full-scan.py' : 'zap-baseline.py';
      dockerArgs.push(
        scriptName,
        '-t',
        zapTarget,
        '-r',
        `/zap/wrk/zap-${context.jobId}-report.html`,
        '-x',
        `/zap/wrk/zap-${context.jobId}.xml`,
        '-J',
        `/zap/wrk/zap-${context.jobId}.json`,
      );
      if (ajaxSpider) {
        dockerArgs.push('-j');
      }
      dockerArgs.push('-I');
    }

    const authArgs = await this.buildAuthArgs(context, configuration, workDir);
    dockerArgs.push(...authArgs);

    await context.onEvent('scan_started', `Starting OWASP ZAP scan on ${target}`, {
      args: dockerArgs,
    });
    await context.onProgress(5, 'Starting ZAP Docker container');

    await execFileAsync('docker', dockerArgs, {
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

  /**
   * Build extra ZAP CLI arguments for authenticated scanning. Bearer auth
   * injects an Authorization header on every request via the ZAP "replacer"
   * add-on. Form auth writes a ZAP context file defining a formBasedAuthentication
   * method and a user, then references it with `-n`/`-U` (both natively
   * supported by zap-full-scan.py / zap-baseline.py).
   */
  private async buildAuthArgs(
    context: ScannerContext,
    configuration: Record<string, unknown>,
    workDir: string,
  ): Promise<string[]> {
    const auth = configuration['auth'] as Record<string, unknown> | undefined;
    if (!auth) {
      return [];
    }

    const authType = auth['type'];

    if (authType === 'bearer') {
      const token = context.credentials?.token ?? context.credentials?.apiKey;
      if (token === undefined || token === '') {
        return [];
      }
      return [
        '-z',
        `-config replacer.full_list(0).description=auth ` +
          `-config replacer.full_list(0).enabled=true ` +
          `-config replacer.full_list(0).matchtype=REQ_HEADER ` +
          `-config replacer.full_list(0).matchstr=Authorization ` +
          `-config replacer.full_list(0).regex=false ` +
          `-config replacer.full_list(0).replacement=Bearer\\ ${token}`,
      ];
    }

    if (authType === 'form') {
      const loginUrl = auth['loginUrl'];
      const usernameField = auth['usernameField'];
      const passwordField = auth['passwordField'];
      const loggedInIndicator = auth['loggedInIndicator'];
      const username = context.credentials?.username;
      const password = context.credentials?.password;

      if (
        typeof loginUrl !== 'string' ||
        !this.isValidHttpUrl(loginUrl) ||
        typeof usernameField !== 'string' ||
        typeof passwordField !== 'string' ||
        typeof loggedInIndicator !== 'string' ||
        username === undefined ||
        username === '' ||
        password === undefined ||
        password === ''
      ) {
        return [];
      }

      const contextFile = `${workDir}/zap-context-${context.jobId}.xml`;
      const contextXml = this.buildAuthContextXml({
        loginUrl,
        usernameField,
        passwordField,
        loggedInIndicator,
        username,
        password,
      });

      const fs = await import('fs/promises');
      await fs.writeFile(contextFile, contextXml, 'utf-8');

      return ['-n', `/zap/wrk/zap-context-${context.jobId}.xml`, '-U', this.escapeXml(username)];
    }

    return [];
  }

  private buildAuthContextXml(auth: {
    loginUrl: string;
    usernameField: string;
    passwordField: string;
    loggedInIndicator: string;
    username: string;
    password: string;
  }): string {
    const loginBody = `${this.escapeXml(auth.usernameField)}={%username%}&amp;${this.escapeXml(auth.passwordField)}={%password%}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <context>
    <name>sentinelx-auth</name>
    <inscope>true</inscope>
    <authentication>
      <type>form</type>
      <form>
        <loginurl>${this.escapeXml(auth.loginUrl)}</loginurl>
        <loginbody>${loginBody}</loginbody>
      </form>
      <loggedin>${this.escapeXml(auth.loggedInIndicator)}</loggedin>
    </authentication>
    <users>
      <user>
        <name>${this.escapeXml(auth.username)}</name>
        <username>${this.escapeXml(auth.username)}</username>
        <password>${this.escapeXml(auth.password)}</password>
      </user>
    </users>
  </context>
</configuration>
`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private isValidHttpUrl(value: string): boolean {
    if (/\s/.test(value)) {
      return false;
    }
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  parse(rawOutput: string, context: ScannerContext): Promise<NormalizedFinding[]> {
    const findings: NormalizedFinding[] = [];
    if (!rawOutput.trim()) {
      return Promise.resolve(findings);
    }

    if (rawOutput.trim().startsWith('<')) {
      return Promise.resolve(this.parseXml(rawOutput, context.target));
    }

    try {
      const json = JSON.parse(rawOutput) as ZapJsonReport;
      return Promise.resolve(this.parseJson(json, context.target));
    } catch {
      return Promise.resolve(findings);
    }
  }

  private parseXml(xml: string, target: string): NormalizedFinding[] {
    const findings: NormalizedFinding[] = [];
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name): boolean => ['alertitem', 'instance'].includes(name),
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
        cweIds: alert.cweid !== undefined && alert.cweid !== '' ? [`CWE-${alert.cweid}`] : [],
        solution: alert.solution ?? undefined,
        evidence: alert.evidence ?? instances[0]?.evidence,
        references:
          alert.reference !== undefined && alert.reference !== '' ? [alert.reference] : [],
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
        cweIds: alert.cweid !== undefined && alert.cweid !== '' ? [`CWE-${alert.cweid}`] : [],
        solution: alert.solution ?? undefined,
        evidence: alert.evidence ?? instance?.evidence,
        references:
          alert.reference !== undefined && alert.reference !== '' ? [alert.reference] : [],
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
    const mapping = new Map<number, number>([
      [3, 8.5], // High
      [2, 5.5], // Medium
      [1, 2.5], // Low
      [0, 0.0], // Info
    ]);
    return mapping.get(code) ?? 0;
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

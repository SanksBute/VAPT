import type { NormalizedFinding } from '@sentinelx/shared';
import { XMLParser } from 'fast-xml-parser';

import { BaseScanner } from '../base/base-scanner';
import type { ScannerContext, ScannerMetadata } from '../interfaces/scanner.interface';

export class OpenVasParser extends BaseScanner {
  readonly metadata: ScannerMetadata = {
    type: 'OPENVAS',
    version: '22.4',
    displayName: 'OpenVAS',
    description: 'Full-featured vulnerability scanner — open-source alternative to Nessus',
    supportedScanTypes: ['VULNERABILITY_ASSESSMENT'],
    supportedTargetTypes: ['ip', 'cidr', 'hostname', 'domain'],
    requiresCredentials: true,
    supportsParallel: false,
    supportsResume: true,
    maxTargets: 1000,
    defaultTimeout: 86400,
    outputFormat: 'xml',
  };

  async isAvailable(): Promise<boolean> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      await execFileAsync('gvmd', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  getVersion(): Promise<string> {
    return Promise.resolve('22.4');
  }

  // Must stay async so the unsupported-operation error rejects the returned Promise
  // rather than throwing synchronously.
  // eslint-disable-next-line @typescript-eslint/require-await
  async scan(_context: ScannerContext): Promise<string> {
    // OpenVAS scanning is orchestrated via GMP (Greenbone Management Protocol)
    // The scan results are fetched from the GVM API
    // This implementation handles result parsing from pre-fetched XML reports
    throw new Error(
      'OpenVAS scanning is handled by the GVM API integration. Use the OpenVasService.',
    );
  }

  parse(rawOutput: string, context: ScannerContext): Promise<NormalizedFinding[]> {
    const findings: NormalizedFinding[] = [];
    if (!rawOutput.trim() || !rawOutput.includes('<report')) {
      return Promise.resolve(findings);
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name): boolean => ['result', 'ref'].includes(name),
    });

    const result = parser.parse(rawOutput) as OpenVasReportRoot;
    const results = this.extractResults(result);

    for (const r of results) {
      const nvt = r.nvt;
      if (!nvt) {
        continue;
      }

      const cvssScore = parseFloat(String(nvt.cvss_base ?? nvt['@_cvss_base'] ?? 0));
      const severity =
        cvssScore > 0 ? this.cvssScoreToSeverity(cvssScore) : this.mapSeverity(r.threat ?? 'info');

      const cveIds: string[] = [];
      const refs = nvt.refs?.ref ?? [];
      for (const ref of refs) {
        if (ref['@_type'] === 'cve' && ref['@_id'] !== undefined && ref['@_id'] !== '') {
          cveIds.push(ref['@_id']);
        }
      }

      findings.push({
        scanner: 'OPENVAS',
        pluginId: nvt['@_oid'],
        title: nvt.name ?? 'Unknown',
        description: r.description ?? '',
        severity,
        target: r.host?.['#text'] ?? context.target,
        port:
          r.port !== undefined && r.port !== ''
            ? parseInt(r.port.split('/')[0] ?? '0', 10)
            : undefined,
        protocol:
          r.port !== undefined && r.port !== '' ? r.port.split('/')[1]?.toLowerCase() : undefined,
        cvssV3Score: cvssScore > 0 ? cvssScore : undefined,
        cveIds,
        cweIds: [],
        solution: typeof nvt.solution === 'string' ? nvt.solution : nvt.solution?.['#text'],
        references: [],
        fingerprint: this.generateFingerprint({
          oid: nvt['@_oid'],
          host: r.host?.['#text'] ?? context.target,
          port: r.port,
        }),
      });
    }

    return Promise.resolve(findings);
  }

  private extractResults(root: OpenVasReportRoot): OpenVasResult[] {
    const report = root.report?.report ?? root.report;
    if (!report) {
      return [];
    }

    const results = report.results?.result;
    if (!results) {
      return [];
    }

    return Array.isArray(results) ? results : [results];
  }
}

interface OpenVasReportRoot {
  report?: {
    report?: {
      results?: { result?: OpenVasResult | OpenVasResult[] };
    };
    results?: { result?: OpenVasResult | OpenVasResult[] };
  };
}

interface OpenVasResult {
  host?: { '#text'?: string };
  port?: string;
  threat?: string;
  description?: string;
  nvt?: {
    '@_oid'?: string;
    name?: string;
    cvss_base?: string | number;
    '@_cvss_base'?: string;
    solution?: { '#text'?: string } | string;
    refs?: { ref?: Array<{ '@_type'?: string; '@_id'?: string }> };
  };
}

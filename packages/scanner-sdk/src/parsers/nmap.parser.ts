import type { NormalizedFinding } from '@sentinelx/shared';
import { XMLParser } from 'fast-xml-parser';
import type { ScannerContext } from '../interfaces/scanner.interface';
import { BaseScanner } from '../base/base-scanner';
import type { ScannerMetadata } from '../interfaces/scanner.interface';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface NmapHost {
  '@_starttime'?: string;
  '@_endtime'?: string;
  status?: { '@_state': string; '@_reason': string };
  address?: NmapAddress | NmapAddress[];
  hostnames?: { hostname?: NmapHostname | NmapHostname[] };
  ports?: { port?: NmapPort | NmapPort[] };
  os?: { osmatch?: NmapOsMatch | NmapOsMatch[] };
  scripts?: { script?: NmapScript | NmapScript[] };
}

interface NmapAddress {
  '@_addr': string;
  '@_addrtype': string;
  '@_vendor'?: string;
}

interface NmapHostname {
  '@_name': string;
  '@_type': string;
}

interface NmapPort {
  '@_protocol': string;
  '@_portid': string;
  state?: { '@_state': string; '@_reason': string };
  service?: {
    '@_name'?: string;
    '@_product'?: string;
    '@_version'?: string;
    '@_extrainfo'?: string;
    '@_cpe'?: string | string[];
  };
  script?: NmapScript | NmapScript[];
}

interface NmapOsMatch {
  '@_name': string;
  '@_accuracy': string;
}

interface NmapScript {
  '@_id': string;
  '@_output': string;
  table?: unknown;
  elem?: unknown;
}

interface NmapXmlRoot {
  nmaprun?: {
    host?: NmapHost | NmapHost[];
    runstats?: {
      finished?: { '@_elapsed': string };
      hosts?: { '@_up': string; '@_down': string; '@_total': string };
    };
  };
}

export class NmapParser extends BaseScanner {
  readonly metadata: ScannerMetadata = {
    type: 'NMAP',
    version: '7.94',
    displayName: 'Nmap',
    description: 'Network Mapper — industry-standard network discovery and security auditing tool',
    supportedScanTypes: ['DISCOVERY', 'PORT_SCAN', 'VULNERABILITY_ASSESSMENT'],
    supportedTargetTypes: ['ip', 'cidr', 'hostname', 'domain'],
    requiresCredentials: false,
    supportsParallel: true,
    supportsResume: false,
    maxTargets: 10000,
    defaultTimeout: 3600,
    outputFormat: 'xml',
    executablePath: '/usr/bin/nmap',
  };

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('nmap --version');
      return true;
    } catch {
      try {
        await execAsync('docker image inspect instrumentisto/nmap:latest');
        return true;
      } catch {
        return false;
      }
    }
  }

  async getVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('nmap --version');
      const match = /Nmap version (\S+)/.exec(stdout);
      return match?.[1] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async scan(context: ScannerContext): Promise<string> {
    const { target, configuration, workDir, timeout } = context;
    const outputFile = `${workDir}/nmap-${context.jobId}.xml`;

    const args = this.buildNmapArgs(target, configuration as unknown as Record<string, unknown>, outputFile);
    const command = `nmap ${args.join(' ')}`;

    await context.onEvent('scan_started', `Starting Nmap scan on ${target}`, { command });
    await context.onProgress(5, 'Initializing Nmap scan');

    const { stdout, stderr } = await execAsync(command, {
      timeout: timeout * 1000,
      maxBuffer: 100 * 1024 * 1024,
      cwd: workDir,
    });

    await context.onProgress(90, 'Nmap scan completed, parsing results');

    const fs = await import('fs/promises');
    try {
      const xmlOutput = await fs.readFile(outputFile, 'utf-8');
      return xmlOutput;
    } catch {
      return stdout + stderr;
    }
  }

  async parse(rawOutput: string, context: ScannerContext): Promise<NormalizedFinding[]> {
    const findings: NormalizedFinding[] = [];

    let xmlData: string = rawOutput;
    if (!rawOutput.trim().startsWith('<')) {
      return findings;
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => ['host', 'port', 'hostname', 'osmatch', 'script', 'address', 'cpe'].includes(name),
    });

    const result = parser.parse(xmlData) as NmapXmlRoot;
    const nmapRun = result.nmaprun;
    if (!nmapRun) return findings;

    const hosts = Array.isArray(nmapRun.host) ? nmapRun.host : nmapRun.host ? [nmapRun.host] : [];

    for (const host of hosts) {
      const hostState = host.status?.['@_state'];
      if (hostState !== 'up') continue;

      const addresses = Array.isArray(host.address) ? host.address : host.address ? [host.address] : [];
      const ipAddress = addresses.find((a) => a['@_addrtype'] === 'ipv4')?.['@_addr'] ??
        addresses.find((a) => a['@_addrtype'] === 'ipv6')?.['@_addr'] ?? context.target;

      const hostnamesObj = host.hostnames?.hostname;
      const hostnameList = Array.isArray(hostnamesObj) ? hostnamesObj : hostnamesObj ? [hostnamesObj] : [];
      const hostname = hostnameList.find((h) => h['@_type'] === 'PTR')?.['@_name'];

      const ports = Array.isArray(host.ports?.port) ? host.ports!.port! : host.ports?.port ? [host.ports.port] : [];

      for (const port of ports) {
        const portState = port.state?.['@_state'];
        if (portState !== 'open') continue;

        const portNum = parseInt(port['@_portid'] ?? '0', 10);
        const protocol = port['@_protocol'] ?? 'tcp';
        const service = port.service;
        const serviceName = service?.['@_name'];
        const serviceProduct = service?.['@_product'];
        const serviceVersion = service?.['@_version'];

        // Report open port as informational finding
        findings.push({
          scanner: 'NMAP',
          pluginId: `open-port-${portNum}-${protocol}`,
          title: `Open Port ${portNum}/${protocol}${serviceName !== undefined ? ` (${serviceName})` : ''}`,
          description:
            `Port ${portNum}/${protocol} is open on ${ipAddress}${hostname !== undefined ? ` (${hostname})` : ''}.` +
            (serviceProduct !== undefined ? ` Service: ${serviceProduct}` : '') +
            (serviceVersion !== undefined ? ` ${serviceVersion}` : ''),
          severity: this.assessPortSeverity(portNum, serviceName ?? ''),
          target: ipAddress,
          port: portNum,
          protocol,
          service: serviceName,
          cveIds: [],
          cweIds: [],
          references: [],
          fingerprint: this.generateFingerprint({
            ip: ipAddress,
            port: portNum,
            protocol,
            service: serviceName,
          }),
        });

        // Parse Nmap scripts output for vulnerabilities
        const scripts = Array.isArray(port.script) ? port.script : port.script ? [port.script] : [];
        for (const script of scripts) {
          const scriptFindings = this.parseScriptOutput(script, ipAddress, portNum, protocol, serviceName ?? '');
          findings.push(...scriptFindings);
        }
      }

      // OS Detection findings
      const osMatches = Array.isArray(host.os?.osmatch) ? host.os!.osmatch! : host.os?.osmatch ? [host.os.osmatch] : [];
      if (osMatches.length > 0) {
        const bestMatch = osMatches[0];
        if (bestMatch !== undefined) {
          findings.push({
            scanner: 'NMAP',
            pluginId: 'os-detection',
            title: `OS Detection: ${bestMatch['@_name']}`,
            description: `Operating system detected on ${ipAddress}: ${bestMatch['@_name']} (${bestMatch['@_accuracy']}% confidence)`,
            severity: 'INFORMATIONAL',
            target: ipAddress,
            cveIds: [],
            cweIds: [],
            references: [],
            fingerprint: this.generateFingerprint({ ip: ipAddress, os: bestMatch['@_name'] }),
          });
        }
      }
    }

    return findings;
  }

  private buildNmapArgs(target: string, config: Record<string, unknown>, outputFile: string): string[] {
    const args: string[] = [];

    // Output format
    args.push('-oX', outputFile);

    // Scan type — SYN (-sS) and UDP (-sU) scans require raw socket access (root).
    // Fall back to an unprivileged TCP connect scan (-sT) when not running as root.
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const scanType = config['portScanType'] as string | undefined;
    if (scanType === 'SYN') {
      args.push(isRoot ? '-sS' : '-sT');
    } else if (scanType === 'UDP') {
      args.push(isRoot ? '-sU' : '-sT');
    } else if (scanType === 'CONNECT') {
      args.push('-sT');
    } else if (scanType === 'COMPREHENSIVE') {
      args.push(...(isRoot ? ['-sS', '-sU'] : ['-sT']));
    } else {
      args.push(isRoot ? '-sS' : '-sT');
    }

    // OS detection
    if (config['osDetection'] === true) {
      args.push('-O');
    }

    // Service/version detection
    if (config['serviceDetection'] !== false) {
      args.push('-sV');
    }

    // Script scan
    if (config['scriptScan'] === true) {
      const scripts = config['scripts'] as string[] | undefined;
      if (scripts && scripts.length > 0) {
        args.push(`--script=${scripts.join(',')}`);
      } else {
        args.push('--script=default,vuln,auth');
      }
    }

    // Ports
    const ports = config['ports'] as string | undefined;
    if (ports) {
      args.push('-p', ports);
    } else {
      args.push('-p', '1-65535');
    }

    // Timing
    const timing = config['timing'] as string | undefined;
    if (timing) {
      args.push(timing);
    } else {
      args.push('-T4');
    }

    // Rate limiting
    const rateLimit = config['rateLimit'] as number | undefined;
    if (rateLimit) {
      args.push(`--max-rate=${rateLimit}`);
    }

    args.push(target);
    return args;
  }

  private assessPortSeverity(
    port: number,
    service: string,
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' {
    const criticalPorts = [22, 23, 445, 3389, 5900, 1433, 3306, 5432, 27017, 6379, 9200];
    const highPorts = [21, 25, 53, 110, 143, 993, 995, 8443];
    const mediumPorts = [80, 8080, 8000, 8888, 9000];

    if (criticalPorts.includes(port)) return 'HIGH';
    if (highPorts.includes(port)) return 'MEDIUM';
    if (mediumPorts.includes(port)) return 'LOW';

    const lowerService = service.toLowerCase();
    if (['telnet', 'ftp', 'rexec', 'rlogin', 'rsh'].includes(lowerService)) return 'HIGH';
    if (['rdp', 'vnc', 'x11'].includes(lowerService)) return 'HIGH';

    return 'INFORMATIONAL';
  }

  private parseScriptOutput(
    script: NmapScript,
    ip: string,
    port: number,
    protocol: string,
    service: string,
  ): NormalizedFinding[] {
    const findings: NormalizedFinding[] = [];
    const scriptId = script['@_id'] ?? '';
    const output = script['@_output'] ?? '';

    if (!output || output.toLowerCase().includes('not vulnerable')) {
      return findings;
    }

    const cveIds = this.extractCveIds(output);
    const severity = this.assessScriptSeverity(scriptId, output);

    if (severity !== 'INFORMATIONAL' || cveIds.length > 0) {
      findings.push({
        scanner: 'NMAP',
        pluginId: `nmap-script-${scriptId}`,
        title: `Nmap Script: ${scriptId}`,
        description: output.substring(0, 2000),
        severity,
        target: ip,
        port,
        protocol,
        service,
        cveIds,
        cweIds: [],
        references: [],
        fingerprint: this.generateFingerprint({ ip, port, scriptId }),
      });
    }

    return findings;
  }

  private assessScriptSeverity(
    scriptId: string,
    output: string,
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' {
    const lowerOutput = output.toLowerCase();
    const lowerScript = scriptId.toLowerCase();

    if (
      lowerOutput.includes('vulnerable') ||
      lowerOutput.includes('critical') ||
      lowerScript.includes('ms17-010') ||
      lowerScript.includes('heartbleed') ||
      lowerScript.includes('shellshock')
    ) {
      return 'CRITICAL';
    }

    if (lowerOutput.includes('warning') || lowerScript.includes('vuln')) {
      return 'HIGH';
    }

    return 'INFORMATIONAL';
  }
}

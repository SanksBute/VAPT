import { asInternal, makeScannerContext } from '../test-utils/mock-context';

import { TrivyParser } from './trivy.parser';

const VALID_TARGET = 'nginx:latest';
const OUTPUT_FILE = '/tmp/out.json';

interface TrivyParserInternal {
  buildTrivyArgs(
    target: string,
    scanType: string,
    config: Record<string, unknown>,
    outputFile: string,
  ): string[];
  determineScanType(target: string, config: Record<string, unknown>): string;
}

describe('TrivyParser command construction', () => {
  let parser: TrivyParser;
  let internal: TrivyParserInternal;

  beforeEach(() => {
    parser = new TrivyParser();
    internal = asInternal<TrivyParserInternal>(parser);
  });

  it('rejects a target injection payload before scanning', async () => {
    const context = makeScannerContext({ target: `${VALID_TARGET}; touch /tmp/pwned` });
    await expect(parser.scan(context)).rejects.toThrow(/Invalid Trivy target/);
  });

  it('rejects an invalid severity', () => {
    expect(() =>
      internal.buildTrivyArgs(
        VALID_TARGET,
        'image',
        { severity: ['critical; rm -rf /'] },
        OUTPUT_FILE,
      ),
    ).toThrow(/Invalid Trivy severity/);
  });

  it('rejects an invalid ignore-file path', () => {
    expect(() =>
      internal.buildTrivyArgs(
        VALID_TARGET,
        'image',
        { ignoredVulns: '../../etc/passwd' },
        OUTPUT_FILE,
      ),
    ).toThrow(/Invalid Trivy ignore file path/);
  });

  it('rejects an invalid explicit scan type', () => {
    expect(() => internal.determineScanType(VALID_TARGET, { trivyScanType: 'evil' })).toThrow(
      /Invalid Trivy scan type/,
    );
  });

  it('builds a well-formed argv array for a valid image target', () => {
    const args = internal.buildTrivyArgs(
      VALID_TARGET,
      'image',
      { severity: ['critical', 'high'] },
      OUTPUT_FILE,
    );
    expect(args).toEqual(expect.arrayContaining(['--severity', 'CRITICAL,HIGH', VALID_TARGET]));
  });
});

describe('TrivyParser.parse', () => {
  const parser = new TrivyParser();

  it('normalizes vulnerabilities, secrets, and misconfigurations into findings', async () => {
    const report = JSON.stringify({
      Results: [
        {
          Target: 'nginx:latest (debian 12)',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2023-1234',
              PkgName: 'openssl',
              InstalledVersion: '1.1.1',
              FixedVersion: '1.1.2',
              Title: 'OpenSSL buffer overflow',
              Severity: 'HIGH',
            },
          ],
          Secrets: [{ RuleID: 'aws-key', Category: 'AWS', Title: 'AWS Access Key' }],
          Misconfigurations: [
            {
              ID: 'DS002',
              Title: 'Root user',
              Severity: 'MEDIUM',
              Resolution: 'Add USER directive',
            },
          ],
        },
      ],
    });

    const context = makeScannerContext({ target: VALID_TARGET });
    const findings = await parser.parse(report, context);

    expect(findings).toHaveLength(3);
    expect(findings.find((f) => f.cveIds.includes('CVE-2023-1234'))?.severity).toBe('HIGH');
    expect(findings.find((f) => f.pluginId === 'secret-aws-key')?.severity).toBe('CRITICAL');
    expect(findings.find((f) => f.pluginId === 'DS002')?.severity).toBe('MEDIUM');
  });

  it('returns no findings for malformed JSON', async () => {
    const context = makeScannerContext();
    expect(await parser.parse('not json', context)).toEqual([]);
  });
});

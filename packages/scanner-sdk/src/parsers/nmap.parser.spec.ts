import { asInternal, makeScannerContext } from '../test-utils/mock-context';

import { NmapParser } from './nmap.parser';

const VALID_TARGET = 'example.com';
const INJECTION_TARGET = `${VALID_TARGET}; touch /tmp/pwned`;
const OUTPUT_FILE = '/tmp/out.xml';

interface NmapParserInternal {
  buildNmapArgs(target: string, config: Record<string, unknown>, outputFile: string): string[];
}

describe('NmapParser command construction', () => {
  let parser: NmapParser;
  let internal: NmapParserInternal;

  beforeEach(() => {
    parser = new NmapParser();
    internal = asInternal<NmapParserInternal>(parser);
  });

  it('rejects a target injection payload before it ever reaches argv', async () => {
    const context = makeScannerContext({ target: INJECTION_TARGET });
    await expect(parser.scan(context)).rejects.toThrow(/Invalid scan target/);
  });

  it('passes a benign target as a single literal argv element, never shell-joined', () => {
    const args = internal.buildNmapArgs(INJECTION_TARGET, {}, OUTPUT_FILE);
    // The whole malicious string is ONE argv entry (last element), so if execFile
    // were invoked, nmap would receive it as a single (invalid) hostname argument —
    // there is no shell to interpret the ';' as a command separator.
    expect(args[args.length - 1]).toBe(INJECTION_TARGET);
    expect(args.filter((a) => a === 'touch')).toHaveLength(0);
  });

  it('rejects a port specification injection payload', () => {
    expect(() =>
      internal.buildNmapArgs(VALID_TARGET, { ports: '22; rm -rf /' }, OUTPUT_FILE),
    ).toThrow(/Invalid port specification/);
  });

  it('accepts a valid port specification', () => {
    const args = internal.buildNmapArgs(VALID_TARGET, { ports: '80,443,8000-8100' }, OUTPUT_FILE);
    expect(args).toContain('80,443,8000-8100');
  });

  it('rejects an invalid Nmap script name', () => {
    expect(() =>
      internal.buildNmapArgs(
        VALID_TARGET,
        { scriptScan: true, scripts: ['vuln; rm -rf /'] },
        OUTPUT_FILE,
      ),
    ).toThrow(/Invalid Nmap script name/);
  });

  it('rejects an invalid timing template', () => {
    expect(() =>
      internal.buildNmapArgs(VALID_TARGET, { timing: '-T4; rm -rf /' }, OUTPUT_FILE),
    ).toThrow(/Invalid timing template/);
  });

  it('rejects a non-numeric rate limit', () => {
    expect(() =>
      internal.buildNmapArgs(VALID_TARGET, { rateLimit: '100; rm -rf /' }, OUTPUT_FILE),
    ).toThrow(/Invalid rate limit/);
  });

  it('builds a well-formed argv array for a benign target', () => {
    const args = internal.buildNmapArgs('192.168.1.0/24', { ports: '80' }, OUTPUT_FILE);
    expect(args).toEqual(
      expect.arrayContaining(['-oX', OUTPUT_FILE, '-p', '80', '192.168.1.0/24']),
    );
  });
});

describe('NmapParser.parse', () => {
  const parser = new NmapParser();

  it('normalizes an open port and a vulnerable NSE script into findings', async () => {
    const xml = `<?xml version="1.0"?>
<nmaprun>
  <host>
    <status state="up" reason="syn-ack"/>
    <address addr="10.0.0.5" addrtype="ipv4"/>
    <hostnames><hostname name="host.example.com" type="PTR"/></hostnames>
    <ports>
      <port protocol="tcp" portid="443">
        <state state="open" reason="syn-ack"/>
        <service name="https" product="OpenSSL" version="1.0.1"/>
        <script id="ssl-heartbleed" output="VULNERABLE: The Heartbleed Bug"/>
      </port>
    </ports>
  </host>
</nmaprun>`;

    const context = makeScannerContext({ target: '10.0.0.5' });
    const findings = await parser.parse(xml, context);

    expect(findings).toHaveLength(2);
    expect(findings[0]?.title).toContain('Open Port 443');
    expect(findings[0]?.target).toBe('10.0.0.5');
    expect(findings[1]?.title).toContain('ssl-heartbleed');
    expect(findings[1]?.severity).toBe('CRITICAL');
  });

  it('returns no findings for non-XML output', async () => {
    const context = makeScannerContext();
    expect(await parser.parse('', context)).toEqual([]);
    expect(await parser.parse('not xml', context)).toEqual([]);
  });
});
